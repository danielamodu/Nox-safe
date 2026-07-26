import { useAccount, useReadContract } from "wagmi";
import { formatEther } from "viem";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ADDRESSES, REGISTRY_ABI } from "../config/contracts";
import { useSafe } from "../hooks/useSafe";
import { SafeInput } from "../components/SafeInput";

export function PolicyView() {
  const { isConnected } = useAccount();
  const { safeAddress } = useSafe();
  const hasSafe = safeAddress.length === 42;

  const { data: policy, isLoading } = useReadContract({
    address: ADDRESSES.PolicyRegistry,
    abi: REGISTRY_ABI,
    functionName: "getPolicy",
    args: hasSafe ? [safeAddress as `0x${string}`] : undefined,
    query: { enabled: hasSafe },
  });

  if (!isConnected) {
    return (
      <div className="card-brutal card-brutal-lg bg-primary dot-pattern text-center py-16">
        <h2 className="font-heading font-bold text-2xl text-black">
          Connect wallet to view policy
        </h2>
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
          Policy Configuration
        </h1>
        <p className="font-body text-sage mt-2">
          View the active policy for your Safe
        </p>
      </div>

      {/* Safe address */}
      <div className="card-brutal">
        <h2 className="font-heading font-bold text-lg mb-4">Safe Address</h2>
        <SafeInput />
      </div>

      {hasSafe && isLoading && (
        <div className="card-brutal text-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {hasSafe && policy && (
        <motion.div
          className="space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          {/* Status */}
          <div
            className={`card-brutal card-brutal-lg ${
              policy.active
                ? "bg-primary dot-pattern"
                : "bg-gray-100 border-dashed opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-2xl text-black">
                  {policy.active ? "Policy Active" : "Policy Inactive"}
                </h2>
                <p className="font-body text-sm text-black/60 mt-1">
                  {policy.active
                    ? "Intents will be validated against this policy"
                    : "No policy set — all intents will be rejected"}
                </p>
              </div>
              <div
                className={`w-6 h-6 rounded-full border-2 border-black ${
                  policy.active ? "bg-green-400" : "bg-red-400"
                }`}
              />
            </div>
          </div>

          {/* Caps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-brutal">
              <div className="w-12 h-12 bg-sage rounded-xl border-2 border-black flex items-center justify-center mb-4">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path d="M12 2v20M2 12h20" stroke="black" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="font-body text-sm text-gray-500 mb-1">
                Max Value Per Transaction
              </p>
              <p className="font-heading font-extrabold text-3xl">
                {formatEther(policy.maxValuePerTx)} <span className="text-lg text-gray-400">ETH</span>
              </p>
            </div>

            <div className="card-brutal">
              <div className="w-12 h-12 bg-primary rounded-xl border-2 border-black flex items-center justify-center mb-4">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" stroke="black" strokeWidth="2.5"/>
                  <path d="M12 7v5l3 3" stroke="black" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="font-body text-sm text-gray-500 mb-1">
                Max Value Per Day
              </p>
              <p className="font-heading font-extrabold text-3xl">
                {formatEther(policy.maxValuePerDay)} <span className="text-lg text-gray-400">ETH</span>
              </p>
            </div>
          </div>

          {/* Whitelist */}
          <div className="card-brutal card-brutal-lg">
            <h2 className="font-heading font-bold text-xl mb-4">
              Whitelisted Targets
              <span className="ml-2 badge-brutal bg-sage text-black text-xs">
                {policy.whitelistedTargets.length}
              </span>
            </h2>

            {policy.whitelistedTargets.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <p className="font-body text-gray-400">
                  No targets whitelisted yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {policy.whitelistedTargets.map((addr: string, i: number) => (
                  <div
                    key={addr}
                    className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-black rounded-xl"
                    style={{
                      boxShadow: `${2 + i}px ${2 + i}px 0px 0px #000`,
                    }}
                  >
                    <div className="w-8 h-8 bg-sage rounded-lg border-2 border-black flex items-center justify-center font-heading font-bold text-sm">
                      {i + 1}
                    </div>
                    <span className="font-mono text-sm break-all flex-1">
                      {addr}
                    </span>
                    <div className="w-3 h-3 rounded-full bg-green-400 border border-black" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How to update */}
          <div className="card-brutal bg-charcoal text-sage space-y-4">
            <h3 className="font-heading font-bold text-lg text-primary">
              Update Policy
            </h3>
            <p className="font-body text-sm leading-relaxed">
              Policies can only be changed by the Safe itself via a multisig transaction.
              Use the Setup wizard to propose a new policy — all required owners will be prompted to sign.
            </p>
            <Link
              to="/app/setup"
              className="btn-primary btn-brutal-lg block text-center"
            >
              Update Spending Rules →
            </Link>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
