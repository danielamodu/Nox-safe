import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { motion } from "motion/react";
import { isAddress } from "viem";
import { ADDRESSES, PROXY_ABI, SABLIER_ABI } from "../config/contracts";
import { friendlyError } from "../utils/errors";

function useWithdrawParams() {
  const params = new URLSearchParams(window.location.search);
  return { stream: params.get("stream") ?? "", sablier: params.get("sablier") ?? "" };
}

// Withdrawal request status: 0 = Pending, 1 = Executed, 2 = Rejected
const STATUS_LABELS: Record<number, string> = {
  0: "Oracle is processing your request…",
  1: "Fulfilled — funds sent to the encrypted recipient",
  2: "Request rejected by oracle",
};

export function NoxPayWithdraw() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const prefill = useWithdrawParams();

  const [sablierAddr, setSablierAddr] = useState<`0x${string}`>(
    (prefill.sablier && isAddress(prefill.sablier)
      ? prefill.sablier
      : ADDRESSES.SablierV2SepoliaLinear) as `0x${string}`
  );
  const [streamId, setStreamId] = useState(prefill.stream);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestId, setRequestId] = useState<`0x${string}` | null>(null);
  const [isSettled, setIsSettled] = useState(false);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  // Extract requestId from receipt once the tx is confirmed
  useEffect(() => {
    if (!receipt) return;
    const proxyLog = receipt.logs.find(
      (l) => l.address.toLowerCase() === ADDRESSES.NoxRecipientProxy.toLowerCase()
    );
    if (proxyLog?.topics[1]) {
      setRequestId(proxyLog.topics[1] as `0x${string}`);
    }
  }, [receipt]);

  // Poll getWithdrawRequest every 10s until the oracle settles the request
  const { data: withdrawRequest } = useReadContract({
    address: ADDRESSES.NoxRecipientProxy,
    abi: PROXY_ABI,
    functionName: "getWithdrawRequest",
    args: requestId ? [requestId] : undefined,
    query: {
      enabled: !!requestId && !isSettled,
      refetchInterval: 10_000,
    },
  });

  const reqStatus = withdrawRequest ? Number(withdrawRequest.status) : null;

  // Stop polling once the oracle settles (status != Pending)
  useEffect(() => {
    if (reqStatus !== null && reqStatus !== 0) setIsSettled(true);
  }, [reqStatus]);

  const handleWithdraw = async () => {
    setError("");
    setRequestId(null);

    if (!isAddress(sablierAddr)) { setError("Invalid Sablier contract address"); return; }
    if (!streamId || isNaN(Number(streamId))) { setError("Enter a valid numeric stream ID"); return; }
    if (!publicClient) { setError("Wallet not connected"); return; }

    try {
      setIsProcessing(true);

      // Pre-flight: check withdrawable amount
      const withdrawable = await publicClient.readContract({
        address: sablierAddr,
        abi: SABLIER_ABI,
        functionName: "withdrawableAmountOf",
        args: [BigInt(streamId)],
      }) as bigint;

      if (withdrawable === 0n) {
        setError("Nothing has vested yet on this stream — check back when the stream has accumulated balance.");
        return;
      }

      writeContract({
        address: ADDRESSES.NoxRecipientProxy,
        abi: PROXY_ABI,
        functionName: "requestShieldedWithdraw",
        args: [sablierAddr, BigInt(streamId)],
      });
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const fillDemo = () => {
    setSablierAddr(ADDRESSES.SablierV2SepoliaLinear);
    setStreamId(ADDRESSES.DemoStreamId);
    setError("");
    setRequestId(null);
    setIsSettled(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-4xl"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge-brutal bg-sage text-black border-black font-mono text-xs">
            NoxPay
          </span>
        </div>
        <h1 className="font-heading font-bold text-2xl text-white">Withdraw</h1>
        <p className="font-body text-sm text-sage/70 mt-1">
          Request a shielded withdrawal. The oracle decrypts the recipient inside the Nox TEE and
          calls <code className="font-mono text-xs">withdrawMax</code> on Sablier directly.
        </p>
      </div>

      {/* Demo stream callout */}
      {ADDRESSES.DemoStreamId && (
        <div className="card-brutal bg-primary border-2 border-black p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-heading font-bold text-sm text-black">Try the Live Demo Stream</p>
            <p className="font-body text-xs text-black/70 mt-0.5">
              Real Sablier V2 stream — Nox-encrypted recipient (Vitalik), oracle-fulfilled. Re-fills every second.
            </p>
          </div>
          <button onClick={fillDemo} className="btn-primary whitespace-nowrap shrink-0">
            Fill Demo →
          </button>
        </div>
      )}

      {/* Form */}
      <div className="card-brutal bg-white border-2 border-black p-6 space-y-5">
        <h2 className="font-heading font-bold text-lg text-black">Request Shielded Withdrawal</h2>
        <p className="font-body text-xs text-black/60">
          Any wallet can submit a withdrawal request — the oracle validates that the stream is vested
          and sends funds to the encrypted recipient.
        </p>

        <div>
          <label className="block font-body font-bold text-xs text-black mb-1">
            Sablier V2 Contract Address
          </label>
          <input
            type="text"
            value={sablierAddr}
            onChange={(e) => setSablierAddr(e.target.value as `0x${string}`)}
            placeholder="0x…"
            className="input-brutal font-mono text-sm"
          />
        </div>

        <div>
          <label className="block font-body font-bold text-xs text-black mb-1">Stream ID</label>
          <input
            type="text"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            placeholder="e.g. 3487"
            className="input-brutal font-mono text-sm"
          />
        </div>

        <button
          onClick={handleWithdraw}
          disabled={!isConnected || isProcessing || isConfirming}
          className="btn-primary w-full py-3 text-base"
        >
          {isProcessing ? "Checking stream…" : isConfirming ? "Submitting…" : "Request Shielded Withdrawal →"}
        </button>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-500 rounded-xl">
            <p className="font-body text-sm text-red-700 break-words">{error}</p>
            <button onClick={() => setError("")} className="font-body text-xs text-red-400 mt-1">
              Dismiss
            </button>
          </div>
        )}

        {/* Success + live oracle status */}
        {isSuccess && (
          <div className="p-4 bg-sage/10 border-2 border-black rounded-xl space-y-3">
            <p className="font-heading font-bold text-sm text-black">
              Withdrawal request submitted
            </p>
            {txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-black/50 hover:text-black transition-colors break-all block"
              >
                {txHash.slice(0, 18)}…{txHash.slice(-10)} ↗
              </a>
            )}

            {/* Oracle status tracking */}
            <div className="border-t border-black/10 pt-3 space-y-2">
              <p className="font-body font-bold text-xs text-black/50 uppercase tracking-wide">
                Oracle status
              </p>

              {!requestId ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-black/30 border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="font-body text-xs text-black/50">Extracting request ID from receipt…</p>
                </div>
              ) : reqStatus === null ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-sage border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="font-body text-xs text-black/70">Polling oracle…</p>
                </div>
              ) : (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${
                  reqStatus === 1
                    ? "bg-green-50 border-green-400"
                    : reqStatus === 2
                    ? "bg-red-50 border-red-400"
                    : "bg-sage/10 border-black/20"
                }`}>
                  {reqStatus === 0 && (
                    <div className="w-3 h-3 border-2 border-sage border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
                  )}
                  {reqStatus === 1 && (
                    <div className="w-3 h-3 bg-green-500 rounded-full shrink-0 mt-0.5" />
                  )}
                  {reqStatus === 2 && (
                    <div className="w-3 h-3 bg-red-500 rounded-full shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-body text-xs font-bold text-black">
                      {STATUS_LABELS[reqStatus] ?? "Unknown status"}
                    </p>
                    {reqStatus === 1 && (
                      <a
                        href={`https://sepolia.etherscan.io/address/${ADDRESSES.NoxRecipientProxy}#events`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-black/50 hover:text-black underline"
                      >
                        View ShieldedWithdrawExecuted event ↗
                      </a>
                    )}
                    {requestId && (
                      <p className="font-mono text-xs text-black/30 break-all">
                        Request ID: {requestId.slice(0, 18)}…
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="card-brutal bg-white/5 border-2 border-white/10 p-5 space-y-2">
        <p className="font-heading font-bold text-sm text-sage">How oracle fulfillment works</p>
        <ol className="space-y-1 font-body text-xs text-white/50 list-decimal list-inside leading-relaxed">
          <li>
            Your request emits{" "}
            <code className="font-mono text-white/60">ShieldedWithdrawRequested</code>
          </li>
          <li>Oracle fetches the decryption proof from the Nox gateway (~30s)</li>
          <li>
            <code className="font-mono text-white/60">Nox.publicDecrypt</code> verifies the proof
            on-chain — the oracle cannot substitute a different address
          </li>
          <li>
            Oracle calls{" "}
            <code className="font-mono text-white/60">withdrawMax(streamId, recipient)</code> on
            Sablier
          </li>
          <li>Tokens land at the decrypted recipient wallet</li>
        </ol>
      </div>
    </motion.div>
  );
}
