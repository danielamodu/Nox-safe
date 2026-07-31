import { useState } from "react";
import {
  useAccount,
  useWalletClient,
  useReadContract,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { motion } from "motion/react";
import { createWalletClient, isAddress, parseUnits, zeroAddress } from "viem";
import { sepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";
import { ADDRESSES, PROXY_ABI, SABLIER_ABI, ERC20_ABI } from "../config/contracts";
import { makeHybridTransport } from "../utils/noxTransport";
import { friendlyError } from "../utils/errors";

type CreateStep =
  | "form"
  | "checking"
  | "approving"
  | "creating"
  | "encrypting"
  | "registering"
  | "done";

const STEP_LABELS: Record<CreateStep, string> = {
  form: "",
  checking: "Checking token details and allowance…",
  approving: "Approve token spending in your wallet…",
  creating: "Create Sablier stream in your wallet…",
  encrypting: "Encrypting recipient via Nox TEE…",
  registering: "Register shielded stream in your wallet…",
  done: "",
};

function StepScreen({
  step,
  statusMsg,
  streamId,
  txHashes,
  onReset,
  onRetryRegister,
}: {
  step: CreateStep;
  statusMsg: string;
  streamId: bigint | null;
  txHashes: { approve?: string; create?: string; register?: string };
  onReset: () => void;
  onRetryRegister: () => void;
}) {
  if (step === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="card-brutal bg-white border-2 border-black p-8 space-y-6 text-center"
      >
        <div className="w-12 h-12 bg-sage border-2 border-black rounded-full flex items-center justify-center mx-auto">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h2 className="font-heading font-bold text-xl text-black">Stream created and shielded</h2>
          <p className="font-body text-sm text-black/60 mt-1">
            The recipient is encrypted on-chain. Share the stream ID with your team so they can
            request withdrawals.
          </p>
        </div>
        {streamId !== null && (
          <div className="bg-sage/10 border-2 border-black rounded-xl p-5">
            <p className="font-body text-xs text-black/50 mb-1">Stream ID</p>
            <p className="font-heading font-bold text-4xl text-black">{streamId.toString()}</p>
            <p className="font-body text-xs text-black/40 mt-2">
              Sablier LockupLinear on Sepolia
            </p>
          </div>
        )}
        <div className="space-y-1 text-left">
          {txHashes.approve && (
            <TxLink label="Approval" hash={txHashes.approve} />
          )}
          {txHashes.create && <TxLink label="Stream created" hash={txHashes.create} />}
          {txHashes.register && <TxLink label="Recipient shielded" hash={txHashes.register} />}
        </div>
        <button onClick={onReset} className="btn-primary w-full">
          Create another stream
        </button>
      </motion.div>
    );
  }

  // Partial success: stream was created but registration failed
  if (step === "form" && streamId !== null) {
    return null; // handled by the form section below
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card-brutal bg-white border-2 border-black p-8 text-center space-y-4"
    >
      <div className="w-10 h-10 border-4 border-sage border-t-transparent rounded-full animate-spin mx-auto" />
      <h2 className="font-heading font-bold text-lg text-black">{STEP_LABELS[step]}</h2>
      {statusMsg && (
        <p className="font-body text-sm text-black/50">{statusMsg}</p>
      )}
      {txHashes.approve && step === "creating" && (
        <TxLink label="Approval confirmed" hash={txHashes.approve} />
      )}
      {txHashes.create && step === "encrypting" && (
        <TxLink label="Stream confirmed" hash={txHashes.create} />
      )}
    </motion.div>
  );
}

function TxLink({ label, hash }: { label: string; hash: string }) {
  return (
    <a
      href={`https://sepolia.etherscan.io/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 font-mono text-xs text-black/50 hover:text-black transition-colors"
    >
      <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
      {label}: {hash.slice(0, 12)}…{hash.slice(-8)} ↗
    </a>
  );
}

export function NoxPayCreate() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Form state
  const [tokenAddr, setTokenAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [recipient, setRecipient] = useState("");

  // Process state
  const [step, setStep] = useState<CreateStep>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [streamId, setStreamId] = useState<bigint | null>(null);
  const [txHashes, setTxHashes] = useState<{ approve?: string; create?: string; register?: string }>({});

  // Eagerly read token info as user types
  const isValidToken = isAddress(tokenAddr);

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: isValidToken },
  });

  const { data: tokenSymbol } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: isValidToken },
  });

  const canSubmit =
    isConnected &&
    isValidToken &&
    tokenDecimals !== undefined &&
    amount.trim() !== "" &&
    Number(durationDays) > 0 &&
    isAddress(recipient) &&
    step === "form";

  const handleCreate = async (overrideStreamId?: bigint) => {
    setError("");

    if (!walletClient || !address || !publicClient) {
      setError("Wallet not connected");
      return;
    }

    const decimals = tokenDecimals ?? 18;
    let parsedAmount: bigint;
    try {
      parsedAmount = parseUnits(amount, decimals);
    } catch {
      setError("Invalid amount — enter a number like 100 or 0.5");
      return;
    }
    if (parsedAmount === 0n) {
      setError("Amount must be greater than zero");
      return;
    }

    const durationSecs = BigInt(Math.round(Number(durationDays) * 86400));

    try {
      // ── Step 1: Check allowance (skip if we're retrying registration) ─────────
      if (!overrideStreamId) {
        setStep("checking");
        setStatusMsg("Reading token allowance…");

        const allowance = await publicClient.readContract({
          address: tokenAddr as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, ADDRESSES.SablierV2SepoliaLinear],
        }) as bigint;

        // ── Step 2: Approve if insufficient ─────────────────────────────────────
        if (allowance < parsedAmount) {
          setStep("approving");
          setStatusMsg("Confirm approval in your wallet…");

          const approveHash = await writeContractAsync({
            address: tokenAddr as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.SablierV2SepoliaLinear, parsedAmount],
          });

          setStatusMsg(`Waiting for approval confirmation… (${approveHash.slice(0, 10)}…)`);
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          setTxHashes((h) => ({ ...h, approve: approveHash }));
        }

        // ── Step 3: Create Sablier stream ────────────────────────────────────────
        setStep("creating");
        setStatusMsg("Confirm stream creation in your wallet…");

        const nextId = await publicClient.readContract({
          address: ADDRESSES.SablierV2SepoliaLinear,
          abi: SABLIER_ABI,
          functionName: "nextStreamId",
        }) as bigint;

        const createHash = await writeContractAsync({
          address: ADDRESSES.SablierV2SepoliaLinear,
          abi: SABLIER_ABI,
          functionName: "createWithDurations",
          args: [
            {
              sender: address,
              recipient: ADDRESSES.NoxRecipientProxy,
              totalAmount: parsedAmount as unknown as bigint, // uint128
              asset: tokenAddr as `0x${string}`,
              cancelable: true,
              transferable: false,
              durations: { cliff: 0n as unknown as number, total: durationSecs as unknown as number },
              broker: { account: zeroAddress, fee: 0n },
            },
          ],
        });

        setStatusMsg(`Waiting for stream creation… (${createHash.slice(0, 10)}…)`);
        await publicClient.waitForTransactionReceipt({ hash: createHash });
        setTxHashes((h) => ({ ...h, create: createHash }));
        setStreamId(nextId);
      }

      const resolvedStreamId = overrideStreamId ?? streamId;
      if (resolvedStreamId === null) throw new Error("Stream ID not set");

      // ── Step 4: Encrypt recipient via Nox TEE ───────────────────────────────
      setStep("encrypting");
      setStatusMsg("Calling Nox TEE gateway to encrypt recipient address…");

      const hybridClient = createWalletClient({
        chain: sepolia,
        transport: makeHybridTransport(walletClient),
        account: walletClient.account,
      });
      const handleClient = await createViemHandleClient(hybridClient);

      const { handle, handleProof } = await handleClient.encryptInput(
        BigInt(recipient),
        "uint256",
        ADDRESSES.NoxRecipientProxy
      );

      // ── Step 5: Register shielded stream ────────────────────────────────────
      setStep("registering");
      setStatusMsg("Confirm registration in your wallet…");

      const registerHash = await writeContractAsync({
        address: ADDRESSES.NoxRecipientProxy,
        abi: PROXY_ABI,
        functionName: "registerShieldedStream",
        args: [
          ADDRESSES.SablierV2SepoliaLinear,
          resolvedStreamId,
          handle as `0x${string}`,
          handleProof as `0x${string}`,
        ],
      });

      setStatusMsg(`Waiting for registration… (${registerHash.slice(0, 10)}…)`);
      await publicClient.waitForTransactionReceipt({ hash: registerHash });
      setTxHashes((h) => ({ ...h, register: registerHash }));

      setStep("done");
    } catch (err: unknown) {
      const msg = friendlyError(err);
      setError(msg);
      // If stream was already created but registration failed, keep step as "form"
      // so the user sees the recovery UI — don't lose the stream ID
      setStep("form");
    }
  };

  const handleReset = () => {
    setStep("form");
    setError("");
    setStreamId(null);
    setTxHashes({});
    setStatusMsg("");
    setTokenAddr("");
    setAmount("");
    setDurationDays("30");
    setRecipient("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge-brutal bg-sage text-black border-black font-mono text-xs">
            NoxPay
          </span>
        </div>
        <h1 className="font-heading font-bold text-2xl text-white">Create a Shielded Payroll Stream</h1>
        <p className="font-body text-sm text-sage/70 mt-1">
          Creates a Sablier V2 stream with NoxRecipientProxy as the nominal recipient, then
          registers the real recipient as an encrypted Nox handle — all in one flow.
        </p>
      </div>

      {/* Step screens (non-form states) */}
      {step !== "form" && step !== "done" && (
        <StepScreen
          step={step}
          statusMsg={statusMsg}
          streamId={streamId}
          txHashes={txHashes}
          onReset={handleReset}
          onRetryRegister={() => streamId !== null && handleCreate(streamId)}
        />
      )}

      {step === "done" && (
        <StepScreen
          step="done"
          statusMsg=""
          streamId={streamId}
          txHashes={txHashes}
          onReset={handleReset}
          onRetryRegister={() => {}}
        />
      )}

      {/* Form (shown at "form" step) */}
      {step === "form" && (
        <>
          {/* Recovery banner: stream created but not yet registered */}
          {streamId !== null && (
            <div className="card-brutal bg-amber-50 border-2 border-amber-500 p-5 space-y-3">
              <p className="font-heading font-bold text-sm text-amber-800">
                Stream #{streamId.toString()} was created but not yet shielded
              </p>
              <p className="font-body text-xs text-amber-700">
                The Sablier stream exists. The registration step failed — retry it below without
                recreating the stream.
              </p>
              <button
                onClick={() => handleCreate(streamId)}
                className="btn-brutal bg-amber-500 text-black text-sm !py-2 !px-5"
              >
                Retry Registration →
              </button>
            </div>
          )}

          <div className="card-brutal bg-white border-2 border-black p-6 space-y-5">
            <h2 className="font-heading font-bold text-lg text-black">Stream details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block font-body font-bold text-xs text-black mb-1">
                  ERC-20 Token Address
                </label>
                <input
                  type="text"
                  value={tokenAddr}
                  onChange={(e) => setTokenAddr(e.target.value)}
                  placeholder="0x…"
                  className="input-brutal font-mono text-sm"
                />
                {isValidToken && tokenSymbol && (
                  <p className="font-body text-xs text-sage mt-1">
                    {tokenSymbol} · {tokenDecimals ?? "?"} decimals
                  </p>
                )}
                {isValidToken && !tokenSymbol && (
                  <p className="font-body text-xs text-black/30 mt-1">Loading token info…</p>
                )}
              </div>

              <div>
                <label className="block font-body font-bold text-xs text-black mb-1">
                  Total Amount{tokenSymbol ? ` (${tokenSymbol})` : ""}
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="input-brutal font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-body font-bold text-xs text-black mb-1">
                  Duration (days)
                </label>
                <input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="30"
                  min="1"
                  className="input-brutal font-mono text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-body font-bold text-xs text-black mb-1">
                  Real Recipient Wallet Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x…"
                  className="input-brutal font-mono text-sm"
                />
                <p className="font-body text-xs text-sage mt-1">
                  Encrypted into a Nox handle before submission — never stored in plaintext.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-500 rounded-xl">
                <p className="font-body text-sm text-red-700 break-words">{error}</p>
                <button onClick={() => setError("")} className="font-body text-xs text-red-400 mt-1">
                  Dismiss
                </button>
              </div>
            )}

            <button
              onClick={() => handleCreate()}
              disabled={!canSubmit}
              className="btn-primary w-full py-3 text-base disabled:opacity-40"
            >
              Create &amp; Shield Stream →
            </button>

            <p className="font-body text-xs text-black/40 text-center">
              3 wallet confirmations: ERC-20 approve (if needed) · create stream · register encrypted recipient
            </p>
          </div>

          {/* How it works */}
          <div className="card-brutal bg-white/5 border-2 border-white/10 p-5 space-y-2">
            <p className="font-heading font-bold text-sm text-sage">What this does</p>
            <ol className="space-y-1 font-body text-xs text-white/50 list-decimal list-inside leading-relaxed">
              <li>Approves Sablier to spend your ERC-20 tokens</li>
              <li>
                Creates a LockupLinear stream with{" "}
                <span className="font-mono text-white/60 break-all">
                  {ADDRESSES.NoxRecipientProxy}
                </span>{" "}
                as the on-chain recipient
              </li>
              <li>Encrypts the real recipient address via the Nox TEE gateway</li>
              <li>Registers the encrypted handle on NoxRecipientProxy</li>
            </ol>
          </div>
        </>
      )}
    </motion.div>
  );
}
