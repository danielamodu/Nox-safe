import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { ADDRESSES } from "../config/contracts";

type State =
  | { status: "loading" }
  | { status: "live"; minutesAgo: number }
  | { status: "starting" }
  | { status: "error" };

function useOracleActivity(): State {
  const publicClient = usePublicClient();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    async function check() {
      const client = publicClient!;
      try {
        const currentBlock = await client.getBlockNumber();
        const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;

        const [executedLogs, withdrawLogs] = await Promise.all([
          client.getLogs({
            address: ADDRESSES.NoxGuardModule,
            event: parseAbiItem(
              "event IntentExecuted(bytes32 indexed intentId, address indexed safe, address target, uint256 value, bytes data)"
            ),
            fromBlock,
            toBlock: currentBlock,
          }),
          client.getLogs({
            address: ADDRESSES.NoxRecipientProxy,
            event: parseAbiItem(
              "event ShieldedWithdrawExecuted(bytes32 indexed requestId, address indexed sablier, uint256 streamId, address indexed recipient, uint128 amount)"
            ),
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        if (cancelled) return;

        const allLogs = [...executedLogs, ...withdrawLogs];
        if (allLogs.length === 0) {
          setState({ status: "starting" });
          return;
        }

        const latestBlock = allLogs.reduce(
          (max, log) => (log.blockNumber! > max ? log.blockNumber! : max),
          0n
        );
        const blocksAgo = currentBlock - latestBlock;
        const minutesAgo = Math.round((Number(blocksAgo) * 12) / 60);
        setState({ status: "live", minutesAgo });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  return state;
}

export function OracleStatus() {
  const state = useOracleActivity();

  if (state.status === "loading" || state.status === "error") return null;

  if (state.status === "live") {
    const label =
      state.minutesAgo === 0
        ? "Oracle live — just fulfilled"
        : `Oracle live — ${state.minutesAgo}m ago`;
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/20 border border-black/30">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-mono text-xs text-black font-semibold">{label}</span>
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/20 border border-black/30">
      <span className="w-2 h-2 rounded-full bg-yellow-400" />
      <span className="font-mono text-xs text-black font-semibold">Oracle starting…</span>
    </div>
  );
}
