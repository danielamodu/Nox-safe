import { useState, useEffect, useRef } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWalletClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { motion } from "motion/react";
import { createWalletClient, custom, isAddress, parseEther } from "viem";
import { sepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";
import { ADDRESSES, MODULE_ABI } from "../config/contracts";
import { useSafe } from "../hooks/useSafe";
import { friendlyError } from "../utils/errors";
import { StatusBadge } from "../components/StatusBadge";

const DRPC_URL = "https://sepolia.drpc.org";

// Methods that MUST go through the connected wallet (signing, account access).
// Everything else — reads, gas estimates, chain queries — goes through DRPC so
// the transport works identically regardless of which wallet is connected.
const WALLET_METHODS = new Set([
  "eth_accounts",
  "eth_requestAccounts",
  "eth_sign",
  "eth_signTransaction",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "personal_sign",
  "eth_sendTransaction",
  "eth_sendRawTransaction",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_getPermissions",
  "wallet_requestPermissions",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHybridTransport(injected: { request: (args: any) => Promise<unknown> }) {
  return custom({
    async request({ method, params }: { method: string; params?: unknown[] }) {
      if (WALLET_METHODS.has(method)) {
        return injected.request({ method, params });
      }
      // All reads and anything unknown go through DRPC — wallet-agnostic.
      const res = await fetch(DRPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? [] }),
      });
      const json = await res.json() as { result?: unknown; error?: { message: string } };
      if (json.error) throw new Error(json.error.message);
      return json.result;
    },
  });
}

type Step = "form" | "encrypting" | "submitting" | "done";

export function SubmitIntent() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { safeAddress } = useSafe();
  const hasSafe = safeAddress.length === 42;

  const [step, setStep] = useState<Step>("form");
  const [target, setTarget] = useState("");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");
  const [error, setError] = useState("");
  const [liveIntentId, setLiveIntentId] = useState<`0x${string}` | "">("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Extract intentId from receipt logs once tx is confirmed
  useEffect(() => {
    if (!receipt) return;
    const log = receipt.logs.find(
      (l) => l.address.toLowerCase() === ADDRESSES.NoxGuardModule.toLowerCase()
    );
    if (log?.topics[1]) setLiveIntentId(log.topics[1] as `0x${string}`);
  }, [receipt]);

  // Poll oracle for live status after submission
  const { data: liveStatus } = useReadContract({
    address: ADDRESSES.NoxGuardModule,
    abi: MODULE_ABI,
    functionName: "getIntentStatus",
    args: liveIntentId ? [liveIntentId as `0x${string}`] : undefined,
    query: {
      enabled: !!liveIntentId && step === "done",
      refetchInterval: 3000,
    },
  });

  // Request notification permission when user submits
  useEffect(() => {
    if (step === "done" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [step]);

  // Fire notification when oracle responds
  const prevStatusRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (liveStatus === undefined) return;
    const status = Number(liveStatus);
    if (prevStatusRef.current === 0 && status !== 0) {
      if (Notification.permission === "granted") {
        new Notification("Nox-Safe", {
          body: status === 1 ? "Your transaction was executed ✓" : "Transaction rejected by oracle",
          icon: "/favicon.ico",
        });
      }
    }
    prevStatusRef.current = status;
  }, [liveStatus]);

  const handleSubmit = async () => {
    setError("");

    if (!isAddress(target)) {
      setError("Invalid target address");
      return;
    }
    if (!/^0x[0-9a-fA-F]*$/.test(data)) {
      setError("Calldata must be valid hex (0x or 0xabcdef...)");
      return;
    }
    if (!walletClient) {
      if (!isConnected) {
        setError("Please connect your wallet first.");
      } else {
        setError("Wallet not ready on Sepolia. Please enable Testnet Mode in your wallet extension and switch to Sepolia.");
      }
      return;
    }

    let valueWei: bigint;
    try {
      valueWei = parseEther(value || "0");
    } catch {
      setError("Invalid ETH value");
      return;
    }

    try {
      setStep("encrypting");

      // Use a hybrid client: reads go through drpc (avoids MetaMask RPC eth_call issues),
      // signing goes through the injected wallet.
      const hybridClient = createWalletClient({
        chain: sepolia,
        transport: makeHybridTransport(walletClient),
        account: walletClient.account,
      });
      const handleClient = await createViemHandleClient(hybridClient);
      const moduleAddr = ADDRESSES.NoxGuardModule;

      const targetAsUint256 = BigInt(target);

      const [
        { handle: targetHandle, handleProof: targetProof },
        { handle: valueHandle, handleProof: valueProof },
      ] = await Promise.all([
        handleClient.encryptInput(targetAsUint256, "uint256", moduleAddr),
        handleClient.encryptInput(valueWei, "uint256", moduleAddr),
      ]);

      setStep("submitting");
      writeContract(
        {
          address: ADDRESSES.NoxGuardModule,
          abi: MODULE_ABI,
          functionName: "submitIntent",
          args: [
            safeAddress as `0x${string}`,
            targetHandle as `0x${string}`,
            targetProof as `0x${string}`,
            valueHandle as `0x${string}`,
            valueProof as `0x${string}`,
            (data || "0x") as `0x${string}`,
          ],
        },
        {
          onSuccess: () => setStep("done"),
          onError: (err) => {
            setError(friendlyError(err));
            setStep("form");
          },
        }
      );
    } catch (err: unknown) {
      setError(friendlyError(err));
      setStep("form");
    }
  };

  if (!isConnected) {
    return (
      <div className="card-brutal card-brutal-lg bg-primary dot-pattern text-center py-16">
        <h2 className="font-heading font-bold text-2xl text-black">
          Connect wallet to submit intents
        </h2>
      </div>
    );
  }

  if (!hasSafe) {
    return (
      <div className="card-brutal text-center py-12">
        <h2 className="font-heading font-bold text-xl mb-2">
          No Safe configured
        </h2>
        <p className="font-body text-gray-500">
          Go to Dashboard and enter your Safe address first.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div>
        <h1 className="font-heading font-extrabold text-4xl text-primary tracking-tight">
          Send Private Transaction
        </h1>
        <p className="font-body text-sage mt-2">
          Your recipient and amount are encrypted before leaving your browser — only the oracle can read them.
        </p>
      </div>

      {/* Form */}
      {step === "form" && (
        <motion.div
          className="card-brutal card-brutal-lg space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <h2 className="font-heading font-bold text-xl">
            Transaction Details
          </h2>

          <div>
            <label className="font-body font-bold text-sm block mb-1">
              Recipient Address
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0x..."
              className="input-brutal font-mono text-sm"
            />
          </div>

          <div>
            <label className="font-body font-bold text-sm block mb-1">
              Amount (ETH)
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.0"
              className="input-brutal font-mono text-sm"
            />
          </div>

          <div>
            <label className="font-body font-bold text-sm block mb-1">
              Calldata (optional, hex)
            </label>
            <input
              type="text"
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="0x"
              className="input-brutal font-mono text-sm"
            />
          </div>

          {chainId !== sepolia.id && isConnected && (
            <div className="p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 my-2">
              <div className="flex flex-col text-left">
                <span className="font-heading font-bold text-xs text-red-400">Wrong Network detected</span>
                <span className="font-body text-xs text-sage/80 mt-0.5">
                  Nox-Safe runs on Sepolia Testnet. Please switch your wallet or enable "Testnet Mode" in Zerion/Rabby.
                </span>
              </div>
              <button
                type="button"
                onClick={() => switchChain({ chainId: sepolia.id })}
                className="btn-brutal bg-white text-black text-xs font-bold shrink-0 !py-2 !px-4 hover:bg-sage/20 transition-colors"
              >
                Switch to Sepolia
              </button>
            </div>
          )}

          {error && <p className="text-red-400 font-body text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

          <button
            onClick={handleSubmit}
            className="btn-primary btn-brutal-lg"
          >
            Send Transaction
          </button>
        </motion.div>
      )}

      {/* Encrypting */}
      {step === "encrypting" && (
        <motion.div
          className="card-brutal card-brutal-lg text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="font-heading font-bold text-xl mb-2">
            Encrypting with Nox TEE...
          </h2>
          <p className="font-body text-gray-500 text-sm">
            Target and value are being encrypted inside the TEE. This takes a moment.
          </p>
        </motion.div>
      )}

      {/* Submitting */}
      {step === "submitting" && (
        <motion.div
          className="card-brutal card-brutal-lg text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="font-heading font-bold text-xl mb-2">
            {isPending ? "Confirm in Wallet..." : "Waiting for Confirmation..."}
          </h2>
          {isConfirming && txHash && (
            <p className="font-mono text-xs text-gray-400">
              tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </p>
          )}
        </motion.div>
      )}

      {/* Done */}
      {step === "done" && (
        <motion.div
          className="card-brutal card-brutal-lg bg-yellow-50 border-yellow-400 text-center py-12"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-12 h-12 bg-primary border-2 border-black rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="font-heading font-bold text-xl mb-2 text-black">
            Transaction Queued
          </h2>
          <p className="font-body text-gray-700 mb-3">
            Your encrypted transaction was broadcast to the blockchain.
          </p>

          {/* Live oracle status */}
          <div className="flex items-center justify-center gap-3 mb-4 py-3 bg-white/60 border-2 border-black/10 rounded-lg">
            <span className="font-body text-sm text-gray-600">Oracle status:</span>
            {!liveIntentId ? (
              <span className="font-mono text-xs text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse inline-block" />
                Waiting for receipt…
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <StatusBadge status={liveStatus !== undefined ? Number(liveStatus) : 0} />
                {(liveStatus === undefined || Number(liveStatus) === 0) && (
                  <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
                )}
              </div>
            )}
          </div>

          {txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-gray-400 hover:text-primary transition-colors break-all px-4 mb-2 block"
            >
              {txHash.slice(0, 18)}…{txHash.slice(-10)} ↗
            </a>
          )}
          <button
            onClick={() => {
              setStep("form");
              setTarget("");
              setValue("0");
              setData("0x");
              setError("");
              setLiveIntentId("");
            }}
            className="btn-accent mt-4"
          >
            Send Another
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
