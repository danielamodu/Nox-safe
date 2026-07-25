import { useEffect, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { isAddress, parseEther } from "viem";
import { useNavigate } from "react-router-dom";
import { ADDRESSES, REGISTRY_ABI, SAFE_ABI } from "../config/contracts";
import { useSafe } from "../hooks/useSafe";
import { useSafeSetup } from "../hooks/useSafeSetup";

// Step IDs
type Step = "safe" | "module" | "policy" | "done";

// ─── Step indicator ────────────────────────────────────────────────────────

function StepDots({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "safe", label: "Safe" },
    { id: "module", label: "Enable Module" },
    { id: "policy", label: "Set Policy" },
    { id: "done", label: "Done" },
  ];
  const idx = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-0.5 w-8 ${done ? "bg-primary" : "bg-gray-600"}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-heading font-bold text-sm
                  ${done ? "bg-green-400" : active ? "bg-primary" : "bg-brutal-dark text-gray-500"}`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`font-body text-xs hidden sm:block ${active ? "text-primary font-bold" : done ? "text-green-400" : "text-gray-500"}`}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pending signature card ────────────────────────────────────────────────

type PendingCardProps = {
  safeTxHash: string;
  confirmations: number;
  confirmationsRequired: number;
  alreadySigned: boolean;
  onSign: () => void;
  onExecute: () => void;
  isLoading: boolean;
};

function PendingCard({
  safeTxHash,
  confirmations,
  confirmationsRequired,
  alreadySigned,
  onSign,
  onExecute,
  isLoading,
}: PendingCardProps) {
  const remaining = confirmationsRequired - confirmations;
  const thresholdMet = confirmations >= confirmationsRequired;

  return (
    <div className="card-brutal bg-sage/10 space-y-4 mt-4">
      {/* Signature progress */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: confirmationsRequired }).map((_, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 border-black transition-colors ${
                i < confirmations ? "bg-green-400" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <span className="font-heading font-bold text-sm">
          {confirmations}/{confirmationsRequired} signatures
        </span>
      </div>

      {thresholdMet ? (
        <div className="space-y-3">
          <p className="font-body text-sm font-bold text-green-600">
            Threshold met — ready to execute
          </p>
          <button
            onClick={onExecute}
            disabled={isLoading}
            className="btn-primary btn-brutal-lg disabled:opacity-50"
          >
            {isLoading ? "Executing…" : "Execute Transaction"}
          </button>
          <p className="font-mono text-xs text-gray-400 break-all">{safeTxHash}</p>
        </div>
      ) : alreadySigned ? (
        <div className="space-y-2">
          <p className="font-body text-sm font-bold text-sage">
            Waiting for {remaining} more owner{remaining !== 1 ? "s" : ""} to sign
          </p>
          <p className="font-body text-sm text-gray-500">
            Switch to another owner wallet in MetaMask — the Sign button will appear for them automatically.
          </p>
          <p className="font-mono text-xs text-gray-400 break-all">{safeTxHash}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-body text-sm font-bold">
            This wallet is an owner that hasn't signed yet
          </p>
          <button
            onClick={onSign}
            disabled={isLoading}
            className="btn-primary btn-brutal-lg disabled:opacity-50"
          >
            {isLoading ? "Signing…" : "Sign Transaction"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Setup wizard ─────────────────────────────────────────────────────

export function Setup() {
  const { isConnected, address } = useAccount();
  const { safeAddress, setSafeAddress } = useSafe() as any;
  const navigate = useNavigate();
  const hasSafe = safeAddress?.length === 42;

  // Which wizard step we're on
  const [step, setStep] = useState<Step>("safe");
  const [safeInput, setSafeInput] = useState(safeAddress ?? "");
  const [safeInputError, setSafeInputError] = useState("");

  // Per-step substates
  type SubState = "idle" | "signing" | "pending" | "done";
  const [moduleState, setModuleState] = useState<SubState>("idle");
  const [policyState, setPolicyState] = useState<SubState>("idle");
  const [pendingTxHash, setPendingTxHash] = useState("");

  // Policy form
  const [targets, setTargets] = useState("");
  const [maxPerTx, setMaxPerTx] = useState("0.1");
  const [maxPerDay, setMaxPerDay] = useState("0.5");
  const [formError, setFormError] = useState("");

  // Error from hook
  const [hookError, setHookError] = useState("");

  const {
    isLoading,
    error: hookRawError,
    pendingTxs,
    refreshPendingTxs,
    enableModule,
    setPolicy,
    signAndExecutePending,
    executePending,
  } = useSafeSetup(hasSafe ? safeAddress : "", address);

  // Live on-chain reads
  const { data: isModuleEnabled, refetch: refetchModule } = useReadContract({
    address: hasSafe ? (safeAddress as `0x${string}`) : undefined,
    abi: SAFE_ABI,
    functionName: "isModuleEnabled",
    args: [ADDRESSES.NoxGuardModule],
    query: { enabled: hasSafe && step !== "safe" },
  });

  const { data: threshold } = useReadContract({
    address: hasSafe ? (safeAddress as `0x${string}`) : undefined,
    abi: SAFE_ABI,
    functionName: "getThreshold",
    query: { enabled: hasSafe && step !== "safe" },
  });

  // When we land on module step, check if already enabled
  useEffect(() => {
    if (step === "module" && isModuleEnabled) {
      setModuleState("done");
    }
  }, [step, isModuleEnabled]);

  // Refresh pending txs when address changes (wallet switch) or step changes
  useEffect(() => {
    if (hasSafe && step !== "safe" && step !== "done") {
      refreshPendingTxs();
    }
  }, [address, hasSafe, step]);

  // Poll every 6s while waiting for a co-signer
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const shouldPoll =
      (step === "module" && moduleState === "pending") ||
      (step === "policy" && policyState === "pending");

    if (shouldPoll) {
      pollingRef.current = setInterval(async () => {
        await refreshPendingTxs();
        refetchModule();
        // Check if our pending tx disappeared (executed on-chain)
        const stillPending = pendingTxs.some((t) => t.safeTxHash === pendingTxHash);
        if (!stillPending && pendingTxHash) {
          if (step === "module") {
            setModuleState("done");
            setTimeout(() => setStep("policy"), 800);
          } else {
            setPolicyState("done");
            setTimeout(() => setStep("done"), 800);
          }
        }
      }, 6000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [step, moduleState, policyState, pendingTxHash, pendingTxs]);

  // Propagate hook errors
  useEffect(() => {
    if (hookRawError) setHookError(hookRawError);
  }, [hookRawError]);

  // Ensure step transitions fire even if the timeout was missed
  useEffect(() => {
    if (moduleState === "done" && step === "module") {
      const t = setTimeout(() => setStep("policy"), 800);
      return () => clearTimeout(t);
    }
    if (policyState === "done" && step === "policy") {
      const t = setTimeout(() => setStep("done"), 800);
      return () => clearTimeout(t);
    }
  }, [moduleState, policyState, step]);

  // Find the relevant pending tx for the current step
  const activePendingTx = pendingTxs.find((t) => t.safeTxHash === pendingTxHash);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSafeContinue() {
    if (!isAddress(safeInput)) {
      setSafeInputError("Enter a valid Ethereum address.");
      return;
    }
    setSafeInputError("");
    if (setSafeAddress) setSafeAddress(safeInput);
    setStep("module");
  }

  async function handleEnableModule() {
    setHookError("");
    setModuleState("signing");
    try {
      const result = await enableModule();
      if (result.executed) {
        setModuleState("done");
        setTimeout(() => setStep("policy"), 800);
      } else {
        setPendingTxHash(result.safeTxHash);
        setModuleState("pending");
      }
    } catch {
      setModuleState("idle");
    }
  }

  async function handleSetPolicy() {
    setFormError("");
    setHookError("");
    const lines = targets.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { setFormError("Add at least one target address."); return; }
    if (lines.some((l) => !isAddress(l))) { setFormError("One or more addresses are invalid."); return; }
    let perTx: bigint, perDay: bigint;
    try { perTx = parseEther(maxPerTx); perDay = parseEther(maxPerDay); }
    catch { setFormError("Invalid ETH amount."); return; }
    if (perDay < perTx) { setFormError("Max per day must be ≥ max per transaction."); return; }

    setPolicyState("signing");
    try {
      const result = await setPolicy({ whitelistedTargets: lines, maxValuePerTx: perTx, maxValuePerDay: perDay });
      if (result.executed) {
        setPolicyState("done");
        setTimeout(() => setStep("done"), 800);
      } else {
        setPendingTxHash(result.safeTxHash);
        setPolicyState("pending");
      }
    } catch {
      setPolicyState("idle");
    }
  }

  async function handleSign() {
    setHookError("");
    try {
      await signAndExecutePending(pendingTxHash);
      await refreshPendingTxs();
      const stillPending = pendingTxs.some((t) => t.safeTxHash === pendingTxHash);
      if (!stillPending) {
        if (step === "module") {
          setModuleState("done");
          setTimeout(() => setStep("policy"), 800);
        } else {
          setPolicyState("done");
          setTimeout(() => setStep("done"), 800);
        }
      }
    } catch {
      // error shown via hookError
    }
  }

  async function handleExecute() {
    setHookError("");
    try {
      await executePending(pendingTxHash);
      if (step === "module") {
        setModuleState("done");
        setTimeout(() => setStep("policy"), 800);
      } else {
        setPolicyState("done");
        setTimeout(() => setStep("done"), 800);
      }
    } catch {
      // error shown via hookError
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="card-brutal card-brutal-lg bg-primary dot-pattern text-center py-16">
        <h2 className="font-heading font-bold text-2xl text-black">
          Connect your wallet to begin setup
        </h2>
      </div>
    );
  }

  const thresholdNum = Number(threshold ?? 1);

  return (
    <div className="max-w-lg mx-auto space-y-2">
      <div className="mb-6">
        <h1 className="font-heading font-extrabold text-4xl text-primary tracking-tight">
          Safe Setup
        </h1>
        <p className="font-body text-sage mt-1">
          Enable the guard and configure your spending policy
        </p>
      </div>

      <StepDots current={step} />

      {/* ── Step 1: Safe address ── */}
      {step === "safe" && (
        <div className="card-brutal card-brutal-lg space-y-5">
          <div>
            <h2 className="font-heading font-bold text-xl mb-1">Enter your Safe address</h2>
            <p className="font-body text-sm text-gray-500">
              The Gnosis Safe multisig you want to protect with Nox.
            </p>
          </div>
          <input
            type="text"
            value={safeInput}
            onChange={(e) => { setSafeInput(e.target.value); setSafeInputError(""); }}
            placeholder="0x..."
            className="input-brutal font-mono text-sm"
          />
          {safeInputError && <p className="font-body text-sm text-red-500">{safeInputError}</p>}
          <button onClick={handleSafeContinue} className="btn-primary btn-brutal-lg w-full">
            Continue
          </button>
        </div>
      )}

      {/* ── Step 2: Enable Module ── */}
      {step === "module" && (
        <div className="card-brutal card-brutal-lg space-y-4">
          <div>
            <h2 className="font-heading font-bold text-xl mb-1">Enable Module</h2>
            <p className="font-body text-sm text-gray-500">
              Authorise NoxGuardModule to execute transactions from your Safe.
              This is a one-time Safe transaction.
            </p>
          </div>

          <div className="font-mono text-xs text-gray-400 bg-black/20 px-3 py-2 rounded-lg break-all">
            {ADDRESSES.NoxGuardModule}
          </div>

          {moduleState === "idle" && (
            <button onClick={handleEnableModule} className="btn-primary btn-brutal-lg w-full">
              Enable Module
            </button>
          )}

          {moduleState === "signing" && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="font-body text-sm">Check MetaMask — sign the Safe transaction hash…</p>
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
            <div className="card-brutal bg-sage/10 space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="font-body text-sm">Waiting for co-signer…</p>
              </div>
              <p className="font-body text-xs text-gray-500">
                Switch to another owner wallet in MetaMask. The page will update automatically.
              </p>
              <button onClick={refreshPendingTxs} className="font-body text-xs text-sage underline">
                Refresh now
              </button>
            </div>
          )}

          {moduleState === "done" && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 bg-green-400 rounded-full border-2 border-black flex items-center justify-center font-bold">✓</div>
              <p className="font-body text-sm font-bold">Module enabled — moving to policy…</p>
            </div>
          )}

          {thresholdNum > 1 && moduleState === "idle" && (
            <p className="font-body text-xs text-gray-400">
              This Safe requires {thresholdNum} signatures. After you sign, the tx is held in Safe's
              Transaction Service until a co-signer approves.
            </p>
          )}
        </div>
      )}

      {/* ── Step 3: Set Policy ── */}
      {step === "policy" && (
        <div className="card-brutal card-brutal-lg space-y-5">
          <div>
            <h2 className="font-heading font-bold text-xl mb-1">Set Policy</h2>
            <p className="font-body text-sm text-gray-500">
              Define which addresses can receive funds and how much per transaction / per day.
              This transaction is signed by the Safe itself — only the Safe can change its own policy.
            </p>
          </div>

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
                  onChange={(e) => { setTargets(e.target.value); setFormError(""); }}
                  placeholder={"0xRecipient1\n0xRecipient2"}
                  className="input-brutal font-mono text-xs w-full resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-body font-bold text-sm block mb-1">Max per Tx (ETH)</label>
                  <input
                    type="text"
                    value={maxPerTx}
                    onChange={(e) => setMaxPerTx(e.target.value)}
                    className="input-brutal font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="font-body font-bold text-sm block mb-1">Max per Day (ETH)</label>
                  <input
                    type="text"
                    value={maxPerDay}
                    onChange={(e) => setMaxPerDay(e.target.value)}
                    className="input-brutal font-mono text-sm"
                  />
                </div>
              </div>

              {formError && <p className="font-body text-sm text-red-500">{formError}</p>}

              <button onClick={handleSetPolicy} className="btn-primary btn-brutal-lg w-full">
                Set Policy
              </button>

              {thresholdNum > 1 && (
                <p className="font-body text-xs text-gray-400">
                  Requires {thresholdNum} signatures — same co-sign flow as the previous step.
                </p>
              )}
            </>
          )}

          {policyState === "signing" && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="font-body text-sm">Check MetaMask — sign the Safe transaction hash…</p>
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
            <div className="card-brutal bg-sage/10 space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="font-body text-sm">Waiting for co-signer…</p>
              </div>
              <p className="font-body text-xs text-gray-500">
                Switch to another owner wallet in MetaMask. The page updates automatically.
              </p>
              <button onClick={refreshPendingTxs} className="font-body text-xs text-sage underline">
                Refresh now
              </button>
            </div>
          )}

          {policyState === "done" && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 bg-green-400 rounded-full border-2 border-black flex items-center justify-center font-bold">✓</div>
              <p className="font-body text-sm font-bold">Policy set — wrapping up…</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === "done" && (
        <div className="card-brutal card-brutal-lg bg-green-50 border-green-500 text-center space-y-4 py-10">
          <div className="w-16 h-16 bg-green-400 border-2 border-black rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <h2 className="font-heading font-bold text-2xl text-black">Safe is ready</h2>
          <p className="font-body text-gray-600">
            Module enabled and policy active. You can now submit confidential intents.
          </p>
          <button
            onClick={() => navigate("/app/submit")}
            className="btn-primary btn-brutal-lg"
          >
            Submit an Intent →
          </button>
        </div>
      )}

      {/* Global error */}
      {hookError && (
        <div className="card-brutal bg-red-50 border-red-500 py-3 px-4 mt-4">
          <p className="font-body text-sm text-red-700 break-words">{hookError}</p>
          <button onClick={() => setHookError("")} className="font-body text-xs text-red-400 mt-1">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
