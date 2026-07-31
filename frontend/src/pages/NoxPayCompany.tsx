import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  useAccount,
  useWalletClient,
  useReadContract,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { motion } from "motion/react";
import { createWalletClient, isAddress, parseAbiItem, parseUnits, zeroAddress } from "viem";
import { sepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";
import {
  ADDRESSES,
  PROXY_ABI,
  PROXY_DEPLOYMENT_BLOCK,
  SABLIER_ABI,
  ERC20_ABI,
} from "../config/contracts";
import { makeHybridTransport } from "../utils/noxTransport";
import { friendlyError } from "../utils/errors";

// ─── Shared helpers ───────────────────────────────────────────────────────────

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
            Share the stream ID with your employee so they can request withdrawals.
          </p>
        </div>
        {streamId !== null && (
          <div className="bg-sage/10 border-2 border-black rounded-xl p-5">
            <p className="font-body text-xs text-black/50 mb-1">Stream ID</p>
            <p className="font-heading font-bold text-4xl text-black">{streamId.toString()}</p>
            <p className="font-body text-xs text-black/40 mt-2">Sablier LockupLinear on Sepolia</p>
          </div>
        )}
        <div className="space-y-1 text-left">
          {txHashes.approve && <TxLink label="Approval" hash={txHashes.approve} />}
          {txHashes.create && <TxLink label="Stream created" hash={txHashes.create} />}
          {txHashes.register && <TxLink label="Recipient shielded" hash={txHashes.register} />}
        </div>
        <button onClick={onReset} className="btn-primary w-full">
          Create another stream
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card-brutal bg-white border-2 border-black p-8 text-center space-y-4"
    >
      <div className="w-10 h-10 border-4 border-sage border-t-transparent rounded-full animate-spin mx-auto" />
      <h2 className="font-heading font-bold text-lg text-black">{STEP_LABELS[step]}</h2>
      {statusMsg && <p className="font-body text-sm text-black/50">{statusMsg}</p>}
      {txHashes.approve && step === "creating" && (
        <TxLink label="Approval confirmed" hash={txHashes.approve} />
      )}
      {txHashes.create && step === "encrypting" && (
        <TxLink label="Stream confirmed" hash={txHashes.create} />
      )}
    </motion.div>
  );
}

// ─── Create Stream tab ────────────────────────────────────────────────────────

function CreateStreamTab() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [tokenAddr, setTokenAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [recipient, setRecipient] = useState("");
  const [step, setStep] = useState<CreateStep>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [streamId, setStreamId] = useState<bigint | null>(null);
  const [txHashes, setTxHashes] = useState<{ approve?: string; create?: string; register?: string }>({});

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
    if (!walletClient || !address || !publicClient) { setError("Wallet not connected"); return; }

    const decimals = tokenDecimals ?? 18;
    let parsedAmount: bigint;
    try {
      parsedAmount = parseUnits(amount, decimals);
    } catch {
      setError("Invalid amount — enter a number like 100 or 0.5");
      return;
    }
    if (parsedAmount === 0n) { setError("Amount must be greater than zero"); return; }

    const durationSecs = BigInt(Math.round(Number(durationDays) * 86400));

    try {
      if (!overrideStreamId) {
        setStep("checking");
        setStatusMsg("Reading token allowance…");

        const allowance = await publicClient.readContract({
          address: tokenAddr as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, ADDRESSES.SablierV2SepoliaLinear],
        }) as bigint;

        if (allowance < parsedAmount) {
          setStep("approving");
          setStatusMsg("Confirm approval in your wallet…");
          const approveHash = await writeContractAsync({
            address: tokenAddr as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ADDRESSES.SablierV2SepoliaLinear, parsedAmount],
          });
          setStatusMsg(`Waiting for approval… (${approveHash.slice(0, 10)}…)`);
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          setTxHashes((h) => ({ ...h, approve: approveHash }));
        }

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
          args: [{
            sender: address,
            recipient: ADDRESSES.NoxRecipientProxy,
            totalAmount: parsedAmount as unknown as bigint,
            asset: tokenAddr as `0x${string}`,
            cancelable: true,
            transferable: false,
            durations: { cliff: 0n as unknown as number, total: durationSecs as unknown as number },
            broker: { account: zeroAddress, fee: 0n },
          }],
        });

        setStatusMsg(`Waiting for stream creation… (${createHash.slice(0, 10)}…)`);
        await publicClient.waitForTransactionReceipt({ hash: createHash });
        setTxHashes((h) => ({ ...h, create: createHash }));
        setStreamId(nextId);
      }

      const resolvedStreamId = overrideStreamId ?? streamId;
      if (resolvedStreamId === null) throw new Error("Stream ID not set");

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
      setError(friendlyError(err));
      setStep("form");
    }
  };

  const handleReset = () => {
    setStep("form"); setError(""); setStreamId(null); setTxHashes({}); setStatusMsg("");
    setTokenAddr(""); setAmount(""); setDurationDays("30"); setRecipient("");
  };

  if (step !== "form" && step !== "done") {
    return (
      <StepScreen
        step={step} statusMsg={statusMsg} streamId={streamId}
        txHashes={txHashes} onReset={handleReset}
        onRetryRegister={() => streamId !== null && handleCreate(streamId)}
      />
    );
  }
  if (step === "done") {
    return (
      <StepScreen
        step="done" statusMsg="" streamId={streamId}
        txHashes={txHashes} onReset={handleReset} onRetryRegister={() => {}}
      />
    );
  }

  return (
    <div className="space-y-5">
      {streamId !== null && (
        <div className="card-brutal bg-amber-50 border-2 border-amber-500 p-5 space-y-3">
          <p className="font-heading font-bold text-sm text-amber-800">
            Stream #{streamId.toString()} was created but not yet shielded
          </p>
          <p className="font-body text-xs text-amber-700">
            The Sablier stream exists. The registration step failed — retry below without recreating the stream.
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
              <p className="font-body text-xs text-sage mt-1">{tokenSymbol} · {tokenDecimals ?? "?"} decimals</p>
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
            <label className="block font-body font-bold text-xs text-black mb-1">Duration (days)</label>
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
              Employee Wallet Address
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
            <button onClick={() => setError("")} className="font-body text-xs text-red-400 mt-1">Dismiss</button>
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

      <div className="card-brutal bg-white/5 border-2 border-white/10 p-5 space-y-2">
        <p className="font-heading font-bold text-sm text-sage">What this does</p>
        <ol className="space-y-1 font-body text-xs text-white/50 list-decimal list-inside leading-relaxed">
          <li>Approves Sablier to spend your tokens (one-time per token)</li>
          <li>Creates a real Sablier payroll stream on-chain</li>
          <li>Encrypts the employee's wallet address inside the Nox TEE — never stored in plaintext</li>
          <li>Registers the shielded recipient on-chain — only the oracle can reveal who gets paid</li>
        </ol>
      </div>
    </div>
  );
}

// ─── My Streams tab ───────────────────────────────────────────────────────────

type DiscoveredStream = { sablier: `0x${string}`; streamId: bigint };

const STREAM_SHIELDED_EVENT = parseAbiItem(
  "event StreamShielded(address indexed sablier, uint256 indexed streamId, bytes32 indexed recipientHandle, address sender)"
);

function CompanyStreamCard({ sablier, streamId }: { sablier: `0x${string}`; streamId: bigint }) {
  const [copied, setCopied] = useState(false);

  const { data: shieldedData, isLoading } = useReadContract({
    address: ADDRESSES.NoxRecipientProxy,
    abi: PROXY_ABI,
    functionName: "getShieldedStream",
    args: [sablier, streamId],
    query: { staleTime: 15_000 },
  });

  const { data: sablierStream } = useReadContract({
    address: sablier,
    abi: SABLIER_ABI,
    functionName: "getStream",
    args: [streamId],
    query: { staleTime: 30_000 },
  });

  const stream = shieldedData as
    | { active: boolean; recipientHandle: `0x${string}` }
    | undefined;

  const sStream = sablierStream as
    | { asset: `0x${string}`; amounts: { deposited: bigint } }
    | undefined;

  const { data: tokenSymbol } = useReadContract({
    address: sStream?.asset,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: !!sStream?.asset },
  });

  const { data: tokenDecimals } = useReadContract({
    address: sStream?.asset,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!sStream?.asset },
  });

  const formattedAmount =
    sStream && tokenDecimals !== undefined
      ? (Number(sStream.amounts.deposited) / 10 ** Number(tokenDecimals)).toLocaleString()
      : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(streamId.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="card-brutal bg-white border-2 border-black p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-2xl text-black">#{streamId.toString()}</span>
            {stream && (
              <span className={`badge-brutal font-mono text-xs ${
                stream.active
                  ? "bg-green-100 text-green-800 border-green-800"
                  : "bg-gray-100 text-gray-600 border-gray-400"
              }`}>
                {stream.active ? "Active" : "Inactive"}
              </span>
            )}
          </div>
          {isLoading && <p className="font-body text-xs text-black/40">Loading…</p>}
        </div>

        <button
          onClick={handleCopy}
          className="btn-brutal bg-sage text-black text-xs !py-1.5 !px-4 shrink-0"
        >
          {copied ? "Copied ✓" : "Copy Stream ID"}
        </button>
      </div>

      {sStream && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div>
            <dt className="font-body text-xs text-black/50">Token</dt>
            <dd className="font-mono text-xs text-black">
              {tokenSymbol ?? "—"}{" "}
              <a
                href={`https://sepolia.etherscan.io/address/${sStream.asset}`}
                target="_blank"
                rel="noreferrer"
                className="text-black/40 hover:text-black"
              >
                {sStream.asset.slice(0, 6)}…{sStream.asset.slice(-4)} ↗
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-body text-xs text-black/50">Total deposited</dt>
            <dd className="font-mono text-xs text-black">
              {formattedAmount !== null
                ? `${formattedAmount}${tokenSymbol ? ` ${tokenSymbol}` : ""}`
                : "—"}
            </dd>
          </div>
        </dl>
      )}

      <div className="pt-1 flex items-center gap-4">
        <a
          href={`https://app.sablier.com/stream/LL2-11155111-${streamId.toString()}`}
          target="_blank"
          rel="noreferrer"
          className="font-body text-xs text-black/50 hover:text-black underline transition-colors"
        >
          View on Sablier ↗
        </a>
        <a
          href={`https://sepolia.etherscan.io/address/${sablier}#readContract`}
          target="_blank"
          rel="noreferrer"
          className="font-body text-xs text-black/50 hover:text-black underline transition-colors"
        >
          Etherscan ↗
        </a>
      </div>
    </div>
  );
}

function MyStreamsTab() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [myStreams, setMyStreams] = useState<DiscoveredStream[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");

  useEffect(() => {
    if (!address || !publicClient) { setMyStreams([]); return; }

    const fetchStreams = async () => {
      setIsLoadingStreams(true);
      setDiscoveryError("");
      try {
        const logs = await publicClient.getLogs({
          address: ADDRESSES.NoxRecipientProxy,
          event: STREAM_SHIELDED_EVENT,
          fromBlock: PROXY_DEPLOYMENT_BLOCK,
          toBlock: "latest",
        });

        const found: DiscoveredStream[] = logs
          .filter((log) => log.args.sender?.toLowerCase() === address.toLowerCase())
          .map((log) => ({ sablier: log.args.sablier!, streamId: log.args.streamId! }))
          .filter((s, i, arr) =>
            arr.findIndex((x) => x.streamId === s.streamId && x.sablier === s.sablier) === i
          )
          .reverse();

        setMyStreams(found);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/block range|too large|limit/i.test(msg)) {
          setDiscoveryError("Your RPC limits log queries. Try switching networks or contact support.");
        } else {
          setDiscoveryError("Could not fetch your streams automatically.");
        }
      } finally {
        setIsLoadingStreams(false);
      }
    };

    fetchStreams();
  }, [address, publicClient]);

  if (!address) {
    return (
      <div className="card-brutal bg-white/5 border-2 border-white/10 p-6 text-center">
        <p className="font-body text-sm text-sage/50">Connect your wallet to see your streams.</p>
      </div>
    );
  }

  if (isLoadingStreams) {
    return (
      <div className="flex items-center gap-3 p-5">
        <div className="w-5 h-5 border-4 border-sage border-t-transparent rounded-full animate-spin shrink-0" />
        <p className="font-body text-sm text-sage/60">Scanning on-chain events for your streams…</p>
      </div>
    );
  }

  if (discoveryError) {
    return (
      <div className="card-brutal bg-white/5 border-2 border-red-500/30 p-5">
        <p className="font-body text-sm text-red-400">{discoveryError}</p>
      </div>
    );
  }

  if (myStreams.length === 0) {
    return (
      <div className="card-brutal bg-white/5 border-2 border-white/10 p-8 text-center space-y-2">
        <p className="font-body text-sm text-sage/50">No shielded streams found for your wallet.</p>
        <p className="font-body text-xs text-sage/30">
          Streams you create will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-body font-bold text-xs text-sage/60 uppercase tracking-wide">
        Your Streams ({myStreams.length})
      </p>
      {myStreams.map((s) => (
        <CompanyStreamCard
          key={`${s.sablier}-${s.streamId}`}
          sablier={s.sablier}
          streamId={s.streamId}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type CompanyTab = "create" | "streams";

export function NoxPayCompany() {
  const [tab, setTab] = useState<CompanyTab>("create");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-4xl"
    >
      <div>
        <Link
          to="/app/noxpay"
          className="font-body text-xs text-sage/50 hover:text-sage transition-colors mb-3 inline-block"
        >
          ← NoxPay
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge-brutal bg-sage text-black border-black font-mono text-xs">Company</span>
        </div>
        <h1 className="font-heading font-bold text-2xl text-white">Company Portal</h1>
        <p className="font-body text-sm text-sage/70 mt-1">
          Create shielded payroll streams and share stream IDs with your employees.
        </p>
      </div>

      <div className="flex gap-2 border-b-2 border-white/10 pb-0">
        {(["create", "streams"] as CompanyTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-t-lg font-body font-bold text-sm border-2 border-b-0 transition-all ${
              tab === t
                ? "bg-white text-black border-black"
                : "bg-white/5 text-sage/60 border-white/10 hover:bg-white/10"
            }`}
          >
            {t === "create" ? "Create Stream" : "My Streams"}
          </button>
        ))}
      </div>

      {tab === "create" && <CreateStreamTab />}
      {tab === "streams" && <MyStreamsTab />}
    </motion.div>
  );
}
