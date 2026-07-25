import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import { motion } from "motion/react";
import { formatEther, isAddress, parseEther } from "viem";
import { ADDRESSES, MODULE_ABI, REGISTRY_ABI, SAFE_ABI } from "../config/contracts";
import { useSafe } from "../hooks/useSafe";
import { useSafeSetup } from "../hooks/useSafeSetup";

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full border border-black ${ok ? "bg-green-400" : "bg-yellow-400"}`}
    />
  );
}

function StepBadge({ n, total }: { n: number; total: number }) {
  return (
    <span className="font-mono text-xs text-sage bg-charcoal/40 px-2 py-0.5 rounded-full border border-sage/30">
      Step {n} of {total}
    </span>
  );
}

// ─── Pending signature card ───────────────────────────────────────────────────

function PendingCard({
  safeTxHash,
  confirmations,
  confirmationsRequired,
  alreadySigned,
  onSign,
  onExecute,
  isLoading,
}: {
  safeTxHash: string;
  confirmations: number;
  confirmationsRequired: number;
  alreadySigned: boolean;
  onSign: () => void;
  onExecute: () => void;
  isLoading: boolean;
}) {
  const remaining = confirmationsRequired - confirmations;
  const thresholdMet = confirmations >= confirmationsRequired;

  return (
    <div className="card-brutal bg-sage/10 space-y-4 mt-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: confirmationsRequired }).map((_, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 border-black transition-colors ${i < confirmations ? "bg-green-400" : "bg-gray-200"}`}
            />
          ))}
        </div>
        <span className="font-heading font-bold text-sm">
          {confirmations}/{confirmationsRequired} signatures
        </span>
      </div>

      {thresholdMet ? (
        <div className="space-y-3">
          <p className="font-body text-sm font-bold text-green-600">Threshold met — ready to execute</p>
          <button onClick={onExecute} disabled={isLoading} className="btn-primary btn-brutal-lg disabled:opacity-50">
            {isLoading ? "Executing…" : "Execute Transaction"}
          </button>
        </div>
      ) : alreadySigned ? (
        <div className="space-y-2">
          <p className="font-body text-sm font-bold text-sage">
            Waiting for {remaining} more owner{remaining !== 1 ? "s" : ""} to sign
          </p>
          <p className="font-body text-sm text-gray-500">
            Switch to another owner wallet — the Sign button will appear for them automatically.
          </p>
          <p className="font-mono text-xs text-gray-400 break-all">{safeTxHash}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-body text-sm font-bold">This wallet hasn't signed yet</p>
          <button onClick={onSign} disabled={isLoading} className="btn-primary btn-brutal-lg disabled:opacity-50">
            {isLoading ? "Signing…" : "Sign Transaction"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { safeAddress, setSafeAddress } = useSafe();
  const hasSafe = typeof safeAddress === "string" && safeAddress.length === 42;

  // Safe address input state
  const [safeInput, setSafeInput] = useState(safeAddress ?? "");
  const [safeInputError, setSafeInputError] = useState("");

  // Setup wizard state
  type SubState = "idle" | "signing" | "pending" | "done";
  const [moduleState, setModuleState] = useState<SubState>("idle");
  const [policyState, setPolicyState] = useState<SubState>("idle");
  const [pendingTxHash, setPendingTxHash] = useState("");
  const [hookError, setHookError] = useState("");

  // Policy form
  const [targets, setTargets] = useState("");
  const [maxPerTx, setMaxPerTx] = useState("0.1");
  const [maxPerDay, setMaxPerDay] = useState("1.0");
  const [policyFormError, setPolicyFormError] = useState("");

  // On-chain reads
  const { data: isModuleEnabled, isLoading: moduleLoading, refetch: refetchModule } = useReadContract({
    address: hasSafe ? (safeAddress as `0x${string}`) : undefined,
    abi: SAFE_ABI,
    functionName: "isModuleEnabled",
    args: [ADDRESSES.NoxGuardModule],
    query: { enabled: hasSafe },
  });

  const { data: policy, isLoading: policyLoading, refetch: refetchPolicy } = useReadContract({
    address: ADDRESSES.PolicyRegistry,
    abi: REGISTRY_ABI,
    functionName: "getPolicy",
    args: hasSafe ? [safeAddress as `0x${string}`] : undefined,
    query: { enabled: hasSafe },
  });

  const { data: dailySpend } = useReadContract({
    address: ADDRESSES.NoxGuardModule,
    abi: MODULE_ABI,
    functionName: "dailySpend",
    args: hasSafe
      ? [safeAddress as `0x${string}`, BigInt(Math.floor(Date.now() / 1000 / 86400))]
      : undefined,
    query: { enabled: hasSafe },
  });

  const {
    isLoading,
    pendingTxs,
    refreshPendingTxs,
    enableModule,
    setPolicy,
    signAndExecutePending,
    executePending,
  } = useSafeSetup(hasSafe ? safeAddress : "", address);

  const activePendingTx = pendingTxs.find((t) => t.safeTxHash === pendingTxHash);
  const policyActive = policy?.active === true;
  const isReady = isModuleEnabled && policyActive;

  // Auto-fetch pending txs whenever the safe or wallet changes
  useEffect(() => {
    if (hasSafe && address) refreshPendingTxs();
  }, [hasSafe, address, refreshPendingTxs]);

  // Auto-advance wizard state if another owner already proposed a tx
  useEffect(() => {
    if (!pendingTxs.length) return;
    if (isModuleEnabled === false && moduleState === "idle") {
      const tx = pendingTxs.find((t) => t.description === "Enable NoxGuardModule");
      if (tx) { setPendingTxHash(tx.safeTxHash); setModuleState("pending"); }
    } else if (isModuleEnabled === true && !policyActive && policyState === "idle") {
      const tx = pendingTxs.find((t) => t.description === "Set Policy");
      if (tx) { setPendingTxHash(tx.safeTxHash); setPolicyState("pending"); }
    }
  }, [pendingTxs, isModuleEnabled, policyActive, moduleState, policyState]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSaveSafe() {
    if (!isAddress(safeInput)) { setSafeInputError("Enter a valid Ethereum address."); return; }
    setSafeInputError("");
    setSafeAddress(safeInput);
  }

  async function handleEnableModule() {
    setHookError("");
    setModuleState("signing");
    try {
      const result = await enableModule();
      if (result.executed) {
        setModuleState("done");
        await refetchModule();
      } else {
        setPendingTxHash(result.safeTxHash);
        setModuleState("pending");
        await refreshPendingTxs();
      }
    } catch (e: unknown) {
      setHookError(e instanceof Error ? e.message : String(e));
      setModuleState("idle");
    }
  }

  async function handleSetPolicy() {
    setPolicyFormError("");
    setHookError("");
    const lines = targets.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { setPolicyFormError("Add at least one target address."); return; }
    if (lines.some((l) => !isAddress(l))) { setPolicyFormError("One or more addresses are invalid."); return; }
    let perTx: bigint, perDay: bigint;
    try { perTx = parseEther(maxPerTx); perDay = parseEther(maxPerDay); }
    catch { setPolicyFormError("Invalid ETH amount."); return; }
    if (perDay < perTx) { setPolicyFormError("Max per day must be ≥ max per tx."); return; }

    setPolicyState("signing");
    try {
      const result = await setPolicy({ whitelistedTargets: lines, maxValuePerTx: perTx, maxValuePerDay: perDay });
      if (result.executed) {
        setPolicyState("done");
        await refetchPolicy();
      } else {
        setPendingTxHash(result.safeTxHash);
        setPolicyState("pending");
        await refreshPendingTxs();
      }
    } catch (e: unknown) {
      setHookError(e instanceof Error ? e.message : String(e));
      setPolicyState("idle");
    }
  }

  async function handleSign() {
    setHookError("");
    try {
      await signAndExecutePending(pendingTxHash);
      await refreshPendingTxs();
      await refetchModule();
      await refetchPolicy();
      const stillPending = pendingTxs.some((t) => t.safeTxHash === pendingTxHash);
      if (!stillPending) {
        if (!isModuleEnabled) setModuleState("done");
        else setPolicyState("done");
      }
    } catch (e: unknown) {
      setHookError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleExecute() {
    setHookError("");
    try {
      await executePending(pendingTxHash);
      await refetchModule();
      await refetchPolicy();
      if (!isModuleEnabled) setModuleState("done");
      else setPolicyState("done");
    } catch (e: unknown) {
      setHookError(e instanceof Error ? e.message : String(e));
    }
  }

  // ── Render: Step 0 — no safe ──────────────────────────────────────────────

  if (!hasSafe) {
    return (
      <motion.div
        className="max-w-md mx-auto pt-8 space-y-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-primary">Get started</h1>
          <p className="font-body text-sage mt-1 text-sm">Enter your Gnosis Safe address to continue.</p>
        </div>

        <div className="card-brutal card-brutal-lg space-y-4">
          <div>
            <label className="font-body font-bold text-sm block mb-1">Safe Address</label>
            <input
              type="text"
              value={safeInput}
              onChange={(e) => { setSafeInput(e.target.value); setSafeInputError(""); }}
              placeholder="0x..."
              className="input-brutal font-mono text-sm"
            />
            {safeInputError && <p className="font-body text-sm text-red-500 mt-1">{safeInputError}</p>}
          </div>
          <button onClick={handleSaveSafe} className="btn-primary btn-brutal-lg w-full">
            Continue →
          </button>
          <p className="font-body text-xs text-gray-500 text-center">
            Don't have a Safe?{" "}
            <a href="https://app.safe.global" target="_blank" rel="noreferrer" className="underline text-sage">
              Create one at app.safe.global
            </a>
          </p>
        </div>
      </motion.div>
    );
  }

  // ── Render: Loading — on-chain data still fetching ────────────────────────

  if (hasSafe && (moduleLoading || policyLoading)) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render: Step 1 — module not enabled ──────────────────────────────────

  if (isModuleEnabled === false && moduleState !== "done") {
    return (
      <motion.div
        className="max-w-md mx-auto pt-8 space-y-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-primary">Enable Guard</h1>
            <p className="font-body text-sage mt-1 text-sm">Allow Nox-Safe to execute validated transactions from your Safe.</p>
          </div>
          <StepBadge n={1} total={2} />
        </div>

        <div className="card-brutal card-brutal-lg space-y-4">
          <div className="bg-charcoal/30 rounded-lg px-3 py-2 space-y-1">
            <p className="font-body text-xs text-sage">Safe</p>
            <p className="font-mono text-xs text-white break-all">{safeAddress}</p>
          </div>
          <div className="bg-charcoal/30 rounded-lg px-3 py-2 space-y-1">
            <p className="font-body text-xs text-sage">Module to enable</p>
            <p className="font-mono text-xs text-white break-all">{ADDRESSES.NoxGuardModule}</p>
          </div>

          <p className="font-body text-sm text-gray-400">
            This submits a Safe transaction. Your multisig will need the required number of signatures before it executes on-chain.
          </p>

          {moduleState === "idle" && (
            <button onClick={handleEnableModule} className="btn-primary btn-brutal-lg w-full">
              Enable Module
            </button>
          )}

          {moduleState === "signing" && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="font-body text-sm">Check MetaMask — sign the Safe tx hash…</p>
            </div>
          )}

          {moduleState === "pending" && activePendingTx && (
            <PendingCard
              safeTxHash={activePendingTx.safeTxHash}
              confirmations={activePendingTx.confirmations}
              confirmationsRequired={activePendingTx.confirmationsRequired}
              alreadySigned={activePendingTx.alreadySigned}
              onSign={handleSign}
              onExecute={handleExecute}
              isLoading={isLoading}
            />
          )}

          {moduleState === "pending" && !activePendingTx && (
            <div className="flex items-center gap-3 py-3">
              <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="font-body text-sm">Waiting for co-signer…</p>
                <button onClick={refreshPendingTxs} className="font-body text-xs text-sage underline mt-1">
                  Refresh
                </button>
              </div>
            </div>
          )}

          {hookError && <p className="font-body text-sm text-red-500 break-words">{hookError}</p>}
        </div>

        <button
          onClick={() => { setSafeAddress(""); setSafeInput(""); }}
          className="font-body text-xs text-sage/50 hover:text-sage underline block mx-auto"
        >
          ← Use a different Safe
        </button>
      </motion.div>
    );
  }

  // ── Render: Step 2 — policy not set ──────────────────────────────────────

  if (!policyActive && policyState !== "done") {
    return (
      <motion.div
        className="max-w-md mx-auto pt-8 space-y-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-primary">Set Policy</h1>
            <p className="font-body text-sage mt-1 text-sm">Define who can receive funds and how much.</p>
          </div>
          <StepBadge n={2} total={2} />
        </div>

        <div className="card-brutal card-brutal-lg space-y-5">
          {policyState === "idle" && (
            <>
              <div>
                <label className="font-body font-bold text-sm block mb-1">
                  Whitelisted Target Addresses
                  <span className="font-normal text-gray-400 ml-2">one per line</span>
                </label>
                <textarea
                  rows={3}
                  value={targets}
                  onChange={(e) => { setTargets(e.target.value); setPolicyFormError(""); }}
                  placeholder={"0xRecipient1\n0xRecipient2"}
                  className="input-brutal font-mono text-xs w-full resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-body font-bold text-sm block mb-1">Max per Tx (ETH)</label>
                  <input type="text" value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} className="input-brutal font-mono text-sm" />
                </div>
                <div>
                  <label className="font-body font-bold text-sm block mb-1">Max per Day (ETH)</label>
                  <input type="text" value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} className="input-brutal font-mono text-sm" />
                </div>
              </div>

              {policyFormError && <p className="font-body text-sm text-red-500">{policyFormError}</p>}

              <button onClick={handleSetPolicy} className="btn-primary btn-brutal-lg w-full">
                Set Policy
              </button>
              <p className="font-body text-xs text-gray-500">
                This also requires your Safe's multisig signatures.
              </p>
            </>
          )}

          {policyState === "signing" && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="font-body text-sm">Check MetaMask — sign the Safe tx hash…</p>
            </div>
          )}

          {policyState === "pending" && activePendingTx && (
            <PendingCard
              safeTxHash={activePendingTx.safeTxHash}
              confirmations={activePendingTx.confirmations}
              confirmationsRequired={activePendingTx.confirmationsRequired}
              alreadySigned={activePendingTx.alreadySigned}
              onSign={handleSign}
              onExecute={handleExecute}
              isLoading={isLoading}
            />
          )}

          {policyState === "pending" && !activePendingTx && (
            <div className="flex items-center gap-3 py-3">
              <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="font-body text-sm">Waiting for co-signer…</p>
                <button onClick={refreshPendingTxs} className="font-body text-xs text-sage underline mt-1">Refresh</button>
              </div>
            </div>
          )}

          {hookError && <p className="font-body text-sm text-red-500 break-words">{hookError}</p>}
        </div>
      </motion.div>
    );
  }

  // ── Render: Ready — main dashboard ───────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Status bar */}
      <motion.div
        className="flex flex-wrap items-center gap-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="card-brutal py-2 px-4 flex items-center gap-2">
          <StatusDot ok={true} />
          <span className="font-mono text-xs">Safe: {safeAddress.slice(0, 6)}…{safeAddress.slice(-4)}</span>
        </div>
        <div className="card-brutal py-2 px-4 flex items-center gap-2">
          <StatusDot ok={!!isModuleEnabled} />
          <span className="font-mono text-xs">Module {isModuleEnabled ? "enabled" : "disabled"}</span>
        </div>
        <div className="card-brutal py-2 px-4 flex items-center gap-2">
          <StatusDot ok={policyActive} />
          <span className="font-mono text-xs">Policy {policyActive ? "active" : "inactive"}</span>
        </div>
        <button
          onClick={() => { setSafeAddress(""); setSafeInput(""); }}
          className="font-body text-xs text-sage/50 hover:text-sage underline ml-auto"
        >
          Change Safe
        </button>
      </motion.div>

      {/* Primary action */}
      <motion.div
        className="card-brutal card-brutal-lg bg-primary dot-pattern cursor-pointer hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
        onClick={() => navigate("/app/submit")}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-black">Submit Intent</h2>
            <p className="font-body text-sm text-black/70 mt-1">
              Encrypt and send a confidential transaction to your Safe.
            </p>
          </div>
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shrink-0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="#ffe17c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16 }}
      >
        <div className="card-brutal">
          <p className="font-body text-xs text-gray-500 mb-1">Max Per Transaction</p>
          <p className="font-heading font-bold text-xl">
            {policy?.maxValuePerTx ? `${formatEther(policy.maxValuePerTx)} ETH` : "—"}
          </p>
        </div>
        <div className="card-brutal">
          <p className="font-body text-xs text-gray-500 mb-1">Today's Spend</p>
          <p className="font-heading font-bold text-xl">
            {dailySpend !== undefined ? `${formatEther(dailySpend)} ETH` : "—"}
          </p>
          {policy?.maxValuePerDay !== undefined && policy.maxValuePerDay > 0n && (
            <p className="font-mono text-xs text-gray-400">/ {formatEther(policy.maxValuePerDay)} ETH daily cap</p>
          )}
        </div>
        <div className="card-brutal">
          <p className="font-body text-xs text-gray-500 mb-1">Whitelisted Targets</p>
          <p className="font-heading font-bold text-xl">{policy?.whitelistedTargets?.length ?? "—"}</p>
        </div>
      </motion.div>

      {/* Whitelisted targets */}
      {policy?.whitelistedTargets && policy.whitelistedTargets.length > 0 && (
        <motion.div
          className="card-brutal space-y-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
        >
          <h3 className="font-heading font-bold text-base">Whitelisted Targets</h3>
          {policy.whitelistedTargets.map((addr: string) => (
            <div key={addr} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-2 border-black rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-400 border border-black shrink-0" />
              <span className="font-mono text-sm break-all">{addr}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Quick nav */}
      <motion.div
        className="grid grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.28 }}
      >
        <button onClick={() => navigate("/app/history")} className="card-brutal py-4 text-left hover:bg-sage/10 transition-colors">
          <p className="font-heading font-bold text-sm">Intent History</p>
          <p className="font-body text-xs text-gray-500 mt-0.5">View past encrypted intents</p>
        </button>
        <button onClick={() => navigate("/app/setup")} className="card-brutal py-4 text-left hover:bg-sage/10 transition-colors">
          <p className="font-heading font-bold text-sm">Update Policy</p>
          <p className="font-body text-xs text-gray-500 mt-0.5">Change spending limits or targets</p>
        </button>
      </motion.div>
    </div>
  );
}
