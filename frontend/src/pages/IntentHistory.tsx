import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { createPublicClient, http, fallback, isHex } from "viem";
import { sepolia } from "viem/chains";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "react-router-dom";
import { ADDRESSES, MODULE_ABI } from "../config/contracts";
import { StatusBadge } from "../components/StatusBadge";
import { useSafe } from "../hooks/useSafe";

const drpcClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http("https://sepolia.drpc.org"),
    http("https://ethereum-sepolia-rpc.publicnode.com"),
    http("https://rpc.ankr.com/eth_sepolia"),
  ]),
});

// DRPC free plan caps eth_getLogs at 9 000 blocks per request.
// Chunk into parallel 9 000-block windows covering the last 54 000 blocks
// (~7.5 days at 14 s/block) — more than enough since the contract is new.
const CHUNK = 9_000n;
const LOOK_BACK = 54_000n; // 6 chunks

const STATUS_LABEL: Record<number, string> = { 0: "Pending", 1: "Executed", 2: "Rejected" };

function exportCsv(rows: IntentRow[]) {
  const header = "Intent ID,Status,Timestamp,Block,Tx Hash,Etherscan\n";
  const body = rows
    .map((r) => {
      const ts = r.timestamp ? new Date(r.timestamp * 1000).toISOString() : "";
      const label = STATUS_LABEL[r.status] ?? "Unknown";
      const link = `https://sepolia.etherscan.io/tx/${r.txHash}`;
      return `${r.intentId},${label},${ts},${r.blockNumber},${r.txHash},${link}`;
    })
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nox-safe-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface IntentRow {
  intentId: `0x${string}`;
  status: number;
  timestamp: number;
  blockNumber: bigint;
  txHash: `0x${string}`;
}

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function shortId(id: string) {
  return `${id.slice(0, 10)}…${id.slice(-8)}`;
}

export function IntentHistory() {
  const { isConnected } = useAccount();
  const { safeAddress } = useSafe();
  const hasSafe = safeAddress.length === 42;
  const [searchParams, setSearchParams] = useSearchParams();

  const [intents, setIntents] = useState<IntentRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Manual lookup state
  const [intentId, setIntentId] = useState("");
  const [lookupId, setLookupId] = useState<`0x${string}` | "">("");

  // Deep-link: auto-open intent from ?intent=0x... on mount
  useEffect(() => {
    const param = searchParams.get("intent");
    if (param && isHex(param) && param.length === 66) {
      setIntentId(param);
      setLookupId(param as `0x${string}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: intent, isLoading: lookupLoading, error: lookupError } = useReadContract({
    address: ADDRESSES.NoxGuardModule,
    abi: MODULE_ABI,
    functionName: "getIntent",
    args: lookupId ? [lookupId as `0x${string}`] : undefined,
    query: { enabled: !!lookupId },
  });

  const fetchIntents = useCallback(async () => {
    if (!hasSafe) return;
    setLoadingList(true);
    setListError("");
    try {
      const latest = await drpcClient.getBlockNumber();
      const oldest = latest > LOOK_BACK ? latest - LOOK_BACK : 0n;

      // Build chunk windows: [oldest, oldest+CHUNK), [oldest+CHUNK, oldest+2*CHUNK), …
      const windows: Array<{ from: bigint; to: bigint }> = [];
      for (let from = oldest; from < latest; from += CHUNK) {
        windows.push({ from, to: from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest });
      }

      const eventAbi = {
        type: "event",
        name: "IntentSubmitted",
        inputs: [
          { name: "intentId",     type: "bytes32", indexed: true  },
          { name: "safe",         type: "address",  indexed: true  },
          { name: "targetHandle", type: "bytes32", indexed: false },
          { name: "valueHandle",  type: "bytes32", indexed: false },
          { name: "data",         type: "bytes",   indexed: false },
        ],
      } as const;

      // Fetch all chunks in parallel
      const chunkLogs = await Promise.all(
        windows.map((w) =>
          drpcClient.getLogs({
            address: ADDRESSES.NoxGuardModule,
            event: eventAbi,
            args: { safe: safeAddress as `0x${string}` },
            fromBlock: w.from,
            toBlock: w.to,
          }).catch(() => [])
        )
      );

      const logs = chunkLogs.flat();

      const rows = await Promise.all(
        logs.map(async (log) => {
          const intentId = log.args.intentId as `0x${string}`;
          const [status, block] = await Promise.all([
            drpcClient.readContract({
              address: ADDRESSES.NoxGuardModule,
              abi: MODULE_ABI,
              functionName: "getIntentStatus",
              args: [intentId],
            }).catch(() => 0),
            drpcClient.getBlock({ blockNumber: log.blockNumber! }).catch(() => null),
          ]);
          return {
            intentId,
            status: Number(status),
            timestamp: block ? Number(block.timestamp) : 0,
            blockNumber: log.blockNumber!,
            txHash: log.transactionHash!,
          } satisfies IntentRow;
        })
      );

      setIntents(rows.reverse());
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setLoadingList(false);
    }
  }, [safeAddress, hasSafe]);

  // Initial fetch + 15s auto-refresh (only when a Safe is configured)
  useEffect(() => {
    if (!hasSafe) return;
    fetchIntents();
    const id = setInterval(fetchIntents, 15000);
    return () => clearInterval(id);
  }, [fetchIntents, hasSafe]);

  const handleLookup = () => {
    if (!isHex(intentId) || intentId.length !== 66) return;
    setLookupId(intentId as `0x${string}`);
  };

  const isEmptySafe =
    intent && intent.safe === "0x0000000000000000000000000000000000000000";

  if (!isConnected) {
    return (
      <div className="card-brutal card-brutal-lg bg-primary dot-pattern text-center py-16">
        <h2 className="font-heading font-bold text-2xl text-black">
          Connect wallet to view transaction history
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
          Transaction History
        </h1>
        <p className="font-body text-sage mt-2">
          Recent private transactions submitted from your Safe
        </p>
      </div>

      {/* Recent transactions list */}
      {hasSafe && (
        <motion.div
          className="card-brutal card-brutal-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.06 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-xl">Recent Transactions</h2>
            <div className="flex items-center gap-2">
              {lastRefreshed && (
                <span className="font-mono text-xs text-gray-400">
                  updated {timeAgo(Math.floor(lastRefreshed.getTime() / 1000))}
                </span>
              )}
              {intents.length > 0 && (
                <button
                  onClick={() => exportCsv(intents)}
                  className="font-mono text-xs border-2 border-black px-3 py-1 hover:bg-primary transition-colors"
                >
                  Export CSV
                </button>
              )}
              <button
                onClick={fetchIntents}
                disabled={loadingList}
                className="font-mono text-xs border-2 border-black px-3 py-1 hover:bg-primary transition-colors disabled:opacity-40"
              >
                {loadingList ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          {loadingList && intents.length === 0 && (
            <div className="py-10 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {listError && (
            <p className="font-body text-sm text-red-600 bg-red-50 border-2 border-red-400 p-3">
              {listError}
            </p>
          )}

          {!loadingList && !listError && intents.length === 0 && (
            <div className="py-10 text-center">
              <p className="font-body text-gray-400 text-sm">
                No transactions found for this Safe yet.
              </p>
              <p className="font-body text-gray-300 text-xs mt-1">
                Send a private transaction to see it appear here.
              </p>
            </div>
          )}

          <AnimatePresence>
            {intents.map((row, i) => (
              <motion.div
                key={row.intentId}
                className="flex items-center justify-between border-2 border-black p-4 mb-3 last:mb-0 bg-white hover:bg-primary/5 transition-colors"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-bold truncate">{shortId(row.intentId)}</p>
                  <p className="font-body text-xs text-gray-400 mt-0.5">
                    {row.timestamp ? timeAgo(row.timestamp) : `block ${row.blockNumber}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <StatusBadge status={row.status} />
                  <button
                    onClick={() => {
                      setIntentId(row.intentId);
                      setLookupId(row.intentId);
                      setSearchParams({ intent: row.intentId });
                      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                    }}
                    className="font-mono text-xs border-2 border-black px-2 py-1 hover:bg-primary transition-colors"
                  >
                    Details
                  </button>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${row.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    title="View on Etherscan"
                    className="font-mono text-xs border-2 border-black px-2 py-1 hover:bg-primary transition-colors"
                  >
                    ↗
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {!hasSafe && (
        <div className="card-brutal text-center py-10">
          <p className="font-body text-gray-500">Go to Dashboard and enter your Safe address to see your transaction history.</p>
        </div>
      )}

      {/* Manual lookup */}
      <motion.div
        className="card-brutal card-brutal-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.12 }}
      >
        <h2 className="font-heading font-bold text-xl mb-4">
          Look Up by ID
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={intentId}
            onChange={(e) => setIntentId(e.target.value)}
            placeholder="0x… transaction ID (bytes32)"
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

      {/* Lookup result */}
      {lookupLoading && (
        <div className="card-brutal text-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {lookupError && (
        <div className="card-brutal border-red-500 bg-red-50">
          <p className="font-body text-red-600 text-sm">Error: {lookupError.message}</p>
        </div>
      )}

      {intent && !lookupLoading && !isEmptySafe && (
        <motion.div
          className="card-brutal card-brutal-lg space-y-4"
          key={lookupId}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-xl">Transaction Details</h2>
            <StatusBadge status={intent.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 border-2 border-black rounded-lg p-4">
              <p className="font-body text-xs text-gray-500 mb-1">Safe Address</p>
              <p className="font-mono text-sm break-all">{intent.safe}</p>
            </div>

            <div className="bg-gray-50 border-2 border-black rounded-lg p-4">
              <p className="font-body text-xs text-gray-500 mb-1">Submitted At</p>
              <p className="font-body text-sm">
                {intent.submittedAt
                  ? new Date(Number(intent.submittedAt) * 1000).toLocaleString()
                  : "—"}
              </p>
            </div>

            <div className="bg-gray-50 border-2 border-black rounded-lg p-4 md:col-span-2">
              <p className="font-body text-xs text-gray-500 mb-1">Encrypted Handle</p>
              <p className="font-mono text-xs break-all text-gray-600">{intent.targetHandle}</p>
            </div>
          </div>

          <div className="bg-charcoal/5 border-2 border-black rounded-lg p-4">
            <p className="font-body text-xs text-gray-500 mb-1">Transaction ID</p>
            <p className="font-mono text-xs break-all">{lookupId}</p>
          </div>
        </motion.div>
      )}

      {intent && !lookupLoading && isEmptySafe && (
        <motion.div
          className="card-brutal bg-sage/10 text-center py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <p className="font-heading font-bold text-lg text-sage">
            No transaction found with that ID
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
