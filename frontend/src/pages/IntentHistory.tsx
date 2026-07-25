import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { isHex } from "viem";
import { motion } from "motion/react";
import { ADDRESSES, MODULE_ABI } from "../config/contracts";
import { StatusBadge } from "../components/StatusBadge";

export function IntentHistory() {
  const { isConnected } = useAccount();
  const [intentId, setIntentId] = useState("");
  const [lookupId, setLookupId] = useState<`0x${string}` | "">("");

  const { data: intent, isLoading, error } = useReadContract({
    address: ADDRESSES.NoxGuardModule,
    abi: MODULE_ABI,
    functionName: "getIntent",
    args: lookupId ? [lookupId as `0x${string}`] : undefined,
    query: { enabled: !!lookupId },
  });

  const handleLookup = () => {
    if (!isHex(intentId) || intentId.length !== 66) return;
    setLookupId(intentId as `0x${string}`);
  };

  if (!isConnected) {
    return (
      <div className="card-brutal card-brutal-lg bg-primary dot-pattern text-center py-16">
        <h2 className="font-heading font-bold text-2xl text-black">
          Connect wallet to view intents
        </h2>
      </div>
    );
  }

  const formatTime = (ts: bigint) => {
    if (!ts) return "—";
    return new Date(Number(ts) * 1000).toLocaleString();
  };

  const isEmptySafe =
    intent && intent.safe === "0x0000000000000000000000000000000000000000";

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div>
        <h1 className="font-heading font-extrabold text-4xl text-primary tracking-tight">
          Intent History
        </h1>
        <p className="font-body text-sage mt-2">
          Look up any intent by its ID
        </p>
      </div>

      {/* Lookup */}
      <motion.div
        className="card-brutal card-brutal-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.08 }}
      >
        <h2 className="font-heading font-bold text-xl mb-4">
          Intent Lookup
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={intentId}
            onChange={(e) => setIntentId(e.target.value)}
            placeholder="0x... intent ID (bytes32)"
            className="input-brutal font-mono text-sm flex-1"
          />
          <button
            onClick={handleLookup}
            disabled={!isHex(intentId) || intentId.length !== 66}
            className="btn-primary whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Look Up
          </button>
        </div>
      </motion.div>

      {/* Result */}
      {isLoading && (
        <div className="card-brutal text-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {error && (
        <div className="card-brutal border-red-500 bg-red-50">
          <p className="font-body text-red-600 text-sm">
            Error: {error.message}
          </p>
        </div>
      )}

      {intent && !isLoading && !isEmptySafe && (
        <motion.div
          className="card-brutal card-brutal-lg space-y-4"
          key={lookupId}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-xl">Intent Details</h2>
            <StatusBadge status={intent.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 border-2 border-black rounded-lg p-4">
              <p className="font-body text-xs text-gray-500 mb-1">Safe</p>
              <p className="font-mono text-sm break-all">{intent.safe}</p>
            </div>

            <div className="bg-gray-50 border-2 border-black rounded-lg p-4">
              <p className="font-body text-xs text-gray-500 mb-1">
                Submitted At
              </p>
              <p className="font-body text-sm">
                {formatTime(intent.submittedAt)}
              </p>
            </div>

            <div className="bg-gray-50 border-2 border-black rounded-lg p-4 md:col-span-2">
              <p className="font-body text-xs text-gray-500 mb-1">Handle</p>
              <p className="font-mono text-sm break-all">{intent.targetHandle}</p>
            </div>
          </div>

          <div className="bg-charcoal/5 border-2 border-black rounded-lg p-4">
            <p className="font-body text-xs text-gray-500 mb-1">Intent ID</p>
            <p className="font-mono text-xs break-all">{lookupId}</p>
          </div>
        </motion.div>
      )}

      {intent && !isLoading && isEmptySafe && (
        <motion.div
          className="card-brutal bg-sage/10 text-center py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <p className="font-heading font-bold text-lg text-sage">
            No intent found with that ID
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
