import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { motion } from "motion/react";
import { isAddress } from "viem";
import { ADDRESSES, PROXY_ABI } from "../config/contracts";

export function NoxPayWithdraw() {
  const { isConnected } = useAccount();

  const [sablierAddr, setSablierAddr] = useState<`0x${string}`>(ADDRESSES.SablierV2SepoliaLinear);
  const [streamId, setStreamId] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleWithdraw = async () => {
    setError("");
    if (!isAddress(sablierAddr)) { setError("Invalid Sablier contract address"); return; }
    if (!streamId || isNaN(Number(streamId))) { setError("Enter a valid numeric stream ID"); return; }

    try {
      setIsProcessing(true);
      writeContract({
        address: ADDRESSES.NoxRecipientProxy,
        abi: PROXY_ABI,
        functionName: "requestShieldedWithdraw",
        args: [sablierAddr, BigInt(streamId)],
      });
    } catch (err: unknown) {
      setError(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const fillDemo = () => {
    setSablierAddr(ADDRESSES.SablierV2SepoliaLinear);
    setStreamId(ADDRESSES.DemoStreamId);
    setError("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-2xl"
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
              Real Sablier V2 stream — Nox-encrypted recipient (Vitalik's address), oracle-fulfilled.
              Re-fills ~0.38 NDT/sec after each drain.
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
          {isProcessing || isConfirming ? "Submitting Request…" : "Request Shielded Withdrawal →"}
        </button>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-500 rounded-xl">
            <p className="font-body text-sm text-red-700 break-words">{error}</p>
            <button onClick={() => setError("")} className="font-body text-xs text-red-400 mt-1">
              Dismiss
            </button>
          </div>
        )}

        {isSuccess && (
          <div className="p-4 bg-primary/20 border-2 border-black rounded-xl space-y-2">
            <p className="font-heading font-bold text-sm text-black">
              Withdrawal request submitted
            </p>
            {txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-black/60 hover:text-black transition-colors break-all"
              >
                {txHash.slice(0, 18)}…{txHash.slice(-10)} ↗
              </a>
            )}
            <p className="font-body text-xs text-black/60">
              The oracle picks this up within ~30 seconds, verifies the Nox proof on-chain, and
              calls <code className="font-mono">withdrawMax</code> on Sablier. Check{" "}
              <a
                href={`https://sepolia.etherscan.io/address/${ADDRESSES.NoxRecipientProxy}#events`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-black"
              >
                NoxRecipientProxy events ↗
              </a>{" "}
              for <code className="font-mono">ShieldedWithdrawExecuted</code>.
            </p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="card-brutal bg-white/5 border-2 border-white/10 p-5 space-y-2">
        <p className="font-heading font-bold text-sm text-sage">How oracle fulfillment works</p>
        <ol className="space-y-1 font-body text-xs text-white/50 list-decimal list-inside leading-relaxed">
          <li>Your request emits <code className="font-mono text-white/60">ShieldedWithdrawRequested</code></li>
          <li>Oracle fetches the decryption proof from the Nox gateway</li>
          <li>
            <code className="font-mono text-white/60">Nox.publicDecrypt</code> verifies the proof
            on-chain — oracle cannot substitute a different address
          </li>
          <li>Oracle calls <code className="font-mono text-white/60">withdrawMax(streamId, recipient)</code> on Sablier</li>
          <li>Tokens land at the decrypted recipient wallet</li>
        </ol>
      </div>
    </motion.div>
  );
}
