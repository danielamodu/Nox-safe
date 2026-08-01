import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { motion } from "motion/react";
import { ADDRESSES, PROXY_ABI, SABLIER_ABI, ERC20_ABI } from "../config/contracts";
import { friendlyError } from "../utils/errors";
import { formatUnits } from "viem";

type EmployeeStep = "enter" | "details" | "submitted";

const STATUS_LABELS: Record<number, string> = {
  0: "Oracle is processing your request…",
  1: "Fulfilled — funds sent to your wallet",
  2: "Request rejected by oracle",
};

export function NoxPayEmployee() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();

  // Step state
  const [step, setStep] = useState<EmployeeStep>("enter");
  const [rawStreamId, setRawStreamId] = useState("");
  const [confirmedStreamId, setConfirmedStreamId] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  // Oracle polling state
  const [requestId, setRequestId] = useState<`0x${string}` | null>(null);
  const [isSettled, setIsSettled] = useState(false);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Read stream info once user confirms stream ID
  const streamIdBigInt =
    confirmedStreamId && !isNaN(Number(confirmedStreamId))
      ? BigInt(confirmedStreamId)
      : undefined;

  const { data: shieldedData, isError: isShieldedError } = useReadContract({
    address: ADDRESSES.NoxRecipientProxy,
    abi: PROXY_ABI,
    functionName: "getShieldedStream",
    args: streamIdBigInt !== undefined
      ? [ADDRESSES.SablierV2SepoliaLinear, streamIdBigInt]
      : undefined,
    query: { enabled: step === "details" && streamIdBigInt !== undefined, staleTime: 15_000 },
  });

  const { data: sablierStream } = useReadContract({
    address: ADDRESSES.SablierV2SepoliaLinear,
    abi: SABLIER_ABI,
    functionName: "getStream",
    args: streamIdBigInt !== undefined ? [streamIdBigInt] : undefined,
    query: { enabled: step === "details" && streamIdBigInt !== undefined, staleTime: 15_000 },
  });

  const { data: withdrawableRaw } = useReadContract({
    address: ADDRESSES.SablierV2SepoliaLinear,
    abi: SABLIER_ABI,
    functionName: "withdrawableAmountOf",
    args: streamIdBigInt !== undefined ? [streamIdBigInt] : undefined,
    query: {
      enabled: step === "details" && streamIdBigInt !== undefined,
      refetchInterval: 5_000,
    },
  });

  const shielded = shieldedData as
    | { active: boolean; recipientHandle: `0x${string}` }
    | undefined;

  const sStream = sablierStream as
    | { asset: `0x${string}`; amounts: { deposited: bigint; withdrawn: bigint } }
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

  const withdrawable = withdrawableRaw as bigint | undefined;
  const decimals = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;
  const sym = (tokenSymbol as string | undefined) ?? "";

  const fmtAmount = (raw: bigint) =>
    `${Number(formatUnits(raw, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })}${sym ? ` ${sym}` : ""}`;

  const vested =
    sStream && withdrawable !== undefined
      ? withdrawable + sStream.amounts.withdrawn
      : undefined;

  // Extract requestId from receipt
  useEffect(() => {
    if (!receipt) return;
    const proxyLog = receipt.logs.find(
      (l) => l.address.toLowerCase() === ADDRESSES.NoxRecipientProxy.toLowerCase()
    );
    if (proxyLog?.topics[1]) setRequestId(proxyLog.topics[1] as `0x${string}`);
  }, [receipt]);

  // Poll oracle
  const { data: withdrawRequest } = useReadContract({
    address: ADDRESSES.NoxRecipientProxy,
    abi: PROXY_ABI,
    functionName: "getWithdrawRequest",
    args: requestId ? [requestId] : undefined,
    query: { enabled: !!requestId && !isSettled, refetchInterval: 10_000 },
  });

  const reqStatus = withdrawRequest ? Number((withdrawRequest as { status: number }).status) : null;

  useEffect(() => {
    if (reqStatus !== null && reqStatus !== 0) setIsSettled(true);
  }, [reqStatus]);

  const handleLookup = async () => {
    setError("");
    const id = rawStreamId.trim();
    if (!id || isNaN(Number(id))) { setError("Enter a valid numeric stream ID"); return; }
    if (!publicClient) { setError("Wallet not connected"); return; }

    try {
      setIsChecking(true);
      setConfirmedStreamId(id);
      setStep("details");
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setIsChecking(false);
    }
  };

  const handleWithdraw = async () => {
    setError("");
    setRequestId(null);
    setIsSettled(false);

    if (!publicClient) { setError("Wallet not connected"); return; }
    if (!streamIdBigInt) return;

    if (withdrawable === 0n) {
      setError("Nothing has vested yet on this stream — check back once the stream has accumulated balance.");
      return;
    }

    writeContract({
      address: ADDRESSES.NoxRecipientProxy,
      abi: PROXY_ABI,
      functionName: "requestShieldedWithdraw",
      args: [ADDRESSES.SablierV2SepoliaLinear, streamIdBigInt],
    });

    setStep("submitted");
  };

  const handleReset = () => {
    setStep("enter");
    setRawStreamId("");
    setConfirmedStreamId("");
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
      {/* Header */}
      <div>
        <Link
          to="/app/noxpay"
          className="font-body text-xs text-sage/50 hover:text-sage transition-colors mb-3 inline-block"
        >
          ← NoxPay
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge-brutal bg-sage text-black border-black font-mono text-xs">Employee</span>
        </div>
        <h1 className="font-heading font-bold text-2xl text-white">Withdraw from Your Stream</h1>
        <p className="font-body text-sm text-sage/70 mt-1">
          Enter the stream ID your employer shared with you to view and request your vested pay.
        </p>
      </div>

      {/* Step 1: Enter stream ID */}
      {step === "enter" && (
        <div className="card-brutal bg-white border-2 border-black p-6 space-y-5">
          <div>
            <h2 className="font-heading font-bold text-lg text-black">Enter your stream ID</h2>
            <p className="font-body text-xs text-black/50 mt-1">
              Your employer will share this with you after creating your stream.
            </p>
          </div>

          <div>
            <label className="block font-body font-bold text-xs text-black mb-1">Stream ID</label>
            <input
              type="text"
              value={rawStreamId}
              onChange={(e) => { setRawStreamId(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="e.g. 42"
              className="input-brutal font-mono text-sm"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl">
              <p className="font-body text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleLookup}
            disabled={!isConnected || isChecking || !rawStreamId.trim()}
            className="btn-primary w-full py-3 text-base disabled:opacity-40"
          >
            {isChecking ? "Looking up…" : "Look Up Stream →"}
          </button>
        </div>
      )}

      {/* Step 2: Stream details */}
      {step === "details" && (
        <div className="space-y-5">
          <button
            onClick={() => { setStep("enter"); setError(""); setConfirmedStreamId(""); }}
            className="font-body text-xs text-sage/50 hover:text-sage transition-colors"
          >
            ← Change stream
          </button>

          <div className="card-brutal bg-white border-2 border-black p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-body text-xs text-black/50">Stream ID</p>
                <p className="font-heading font-bold text-3xl text-black">#{confirmedStreamId}</p>
              </div>
              {shielded ? (
                <span className={`badge-brutal font-mono text-xs ${
                  shielded.active
                    ? "bg-green-100 text-green-800 border-green-800"
                    : "bg-gray-100 text-gray-600 border-gray-400"
                }`}>
                  {shielded.active ? "Active" : "Inactive"}
                </span>
              ) : isShieldedError ? (
                <span className="badge-brutal bg-red-100 text-red-700 border-red-500 font-mono text-xs">
                  Not found
                </span>
              ) : (
                <div className="w-4 h-4 border-2 border-sage border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {isShieldedError && (
              <p className="font-body text-sm text-red-600">
                This stream isn't registered as a shielded NoxPay stream. Double-check the stream ID with your employer.
              </p>
            )}

            {shielded && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sStream && withdrawable !== undefined && (
                  <div className="sm:col-span-2 flex items-center gap-2 py-1">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    <span className="font-mono text-xs text-green-700 font-bold">Vesting live</span>
                    <span className="font-body text-xs text-black/40">— updates every 5 seconds</span>
                  </div>
                )}
                {sStream && (
                  <>
                    <div>
                      <dt className="font-body text-xs text-black/50">Token</dt>
                      <dd className="font-mono text-sm text-black font-bold">
                        {sym || "—"}{" "}
                        <a
                          href={`https://sepolia.etherscan.io/address/${sStream.asset}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-normal text-black/40 hover:text-black text-xs"
                        >
                          {sStream.asset.slice(0, 6)}…{sStream.asset.slice(-4)} ↗
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs text-black/50">Total deposited</dt>
                      <dd className="font-mono text-sm text-black font-bold">
                        {fmtAmount(sStream.amounts.deposited)}
                      </dd>
                    </div>
                  </>
                )}
                {vested !== undefined && (
                  <div>
                    <dt className="font-body text-xs text-black/50">Vested so far</dt>
                    <dd className="font-mono text-sm text-black font-bold">{fmtAmount(vested)}</dd>
                  </div>
                )}
                {withdrawable !== undefined && (
                  <div>
                    <dt className="font-body text-xs text-black/50">Withdrawable now</dt>
                    <dd className={`font-mono text-sm font-bold ${withdrawable > 0n ? "text-green-700" : "text-black/40"}`}>
                      {withdrawable > 0n ? fmtAmount(withdrawable) : "Nothing vested yet"}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {error && (
              <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl">
                <p className="font-body text-sm text-red-700">{error}</p>
                <button onClick={() => setError("")} className="font-body text-xs text-red-400 mt-1">Dismiss</button>
              </div>
            )}

            {shielded?.active && (
              <button
                onClick={handleWithdraw}
                disabled={!isConnected || withdrawable === 0n}
                className="btn-primary w-full py-3 text-base disabled:opacity-40"
              >
                {withdrawable === 0n ? "Nothing vested yet" : "Request Shielded Withdrawal →"}
              </button>
            )}

            {shielded?.active && (
              <p className="font-body text-xs text-black/40 text-center">
                The oracle decrypts your address inside the Nox TEE and sends tokens directly to your wallet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Submitted — oracle tracking */}
      {step === "submitted" && (
        <div className="space-y-5">
          <div className="card-brutal bg-white border-2 border-black p-6 space-y-4">
            <div className="flex items-center gap-3">
              {!isSuccess && isConfirming ? (
                <div className="w-5 h-5 border-4 border-sage border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <div className="w-5 h-5 bg-green-500 rounded-full shrink-0" />
              )}
              <p className="font-heading font-bold text-base text-black">
                {isConfirming ? "Submitting withdrawal request…" : "Withdrawal request submitted"}
              </p>
            </div>

            {txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-black/40 hover:text-black transition-colors break-all block"
              >
                {txHash.slice(0, 18)}…{txHash.slice(-10)} ↗
              </a>
            )}

            {isSuccess && (
              <div className="border-t border-black/10 pt-4 space-y-3">
                <p className="font-body font-bold text-xs text-black/50 uppercase tracking-wide">
                  Oracle status
                </p>

                {!requestId ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-black/30 border-t-transparent rounded-full animate-spin shrink-0" />
                    <p className="font-body text-xs text-black/50">Extracting request ID…</p>
                  </div>
                ) : reqStatus === null ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-sage border-t-transparent rounded-full animate-spin shrink-0" />
                    <p className="font-body text-xs text-black/70">Polling oracle every 10s…</p>
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
                    {reqStatus === 1 && <div className="w-3 h-3 bg-green-500 rounded-full shrink-0 mt-0.5" />}
                    {reqStatus === 2 && <div className="w-3 h-3 bg-red-500 rounded-full shrink-0 mt-0.5" />}
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
            )}
          </div>

          <button onClick={handleReset} className="font-body text-xs text-sage/50 hover:text-sage transition-colors">
            ← Back to stream lookup
          </button>
        </div>
      )}

      {/* How it works */}
      {step !== "submitted" && (
        <div className="card-brutal bg-white/5 border-2 border-white/10 p-5 space-y-2">
          <p className="font-heading font-bold text-sm text-sage">How oracle fulfillment works</p>
          <ol className="space-y-1 font-body text-xs text-white/50 list-decimal list-inside leading-relaxed">
            <li>Your request emits <code className="font-mono text-white/60">ShieldedWithdrawRequested</code> on-chain</li>
            <li>Oracle fetches the decryption proof from the Nox gateway (~30s)</li>
            <li><code className="font-mono text-white/60">Nox.publicDecrypt</code> verifies the proof on-chain</li>
            <li>Oracle calls <code className="font-mono text-white/60">withdrawMax</code> on Sablier — tokens land in your wallet</li>
          </ol>
        </div>
      )}
    </motion.div>
  );
}
