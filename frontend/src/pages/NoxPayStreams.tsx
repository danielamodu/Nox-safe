import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { motion } from "motion/react";
import { isAddress, parseAbiItem } from "viem";
import { ADDRESSES, PROXY_ABI, PROXY_DEPLOYMENT_BLOCK } from "../config/contracts";

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

const STREAM_SHIELDED_EVENT = parseAbiItem(
  "event StreamShielded(address indexed sablier, uint256 indexed streamId, bytes32 indexed recipientHandle, address sender)"
);

function StreamCard({
  sablier,
  streamId,
  label,
}: {
  sablier: `0x${string}`;
  streamId: bigint;
  label?: string;
}) {
  const { data, isLoading, isError } = useReadContract({
    address: ADDRESSES.NoxRecipientProxy,
    abi: PROXY_ABI,
    functionName: "getShieldedStream",
    args: [sablier, streamId],
    query: { staleTime: 15_000 },
  });

  const stream = data as
    | { sablier: `0x${string}`; streamId: bigint; recipientHandle: `0x${string}`; sender: `0x${string}`; active: boolean }
    | undefined;

  return (
    <div className="card-brutal bg-white border-2 border-black p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {label && (
            <span className="badge-brutal bg-primary text-black border-black font-mono text-xs">
              {label}
            </span>
          )}
          <span className="font-mono text-sm font-bold text-black">Stream #{streamId.toString()}</span>
        </div>
        {stream && (
          <span
            className={`badge-brutal font-mono text-xs ${
              stream.active
                ? "bg-green-100 text-green-800 border-green-800"
                : "bg-gray-100 text-gray-600 border-gray-400"
            }`}
          >
            {stream.active ? "Active" : "Inactive"}
          </span>
        )}
      </div>

      {isLoading && <p className="font-body text-xs text-black/50">Loading stream info…</p>}

      {isError && (
        <p className="font-body text-xs text-red-600">
          Could not load — check the stream ID and Sablier address.
        </p>
      )}

      {stream && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div>
            <dt className="font-body text-xs text-black/50">Sablier contract</dt>
            <dd className="font-mono text-xs text-black break-all">
              <a
                href={`https://sepolia.etherscan.io/address/${stream.sablier}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {shortAddr(stream.sablier)} ↗
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-body text-xs text-black/50">Stream sender</dt>
            <dd className="font-mono text-xs text-black break-all">
              <a
                href={`https://sepolia.etherscan.io/address/${stream.sender}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {shortAddr(stream.sender)} ↗
              </a>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-body text-xs text-black/50">Encrypted recipient handle</dt>
            <dd className="font-mono text-xs text-black/70 break-all">{stream.recipientHandle}</dd>
          </div>
        </dl>
      )}

      {stream?.active && (
        <div className="pt-1">
          <Link
            to={`/app/noxpay/withdraw?stream=${streamId.toString()}&sablier=${sablier}`}
            className="font-body text-xs font-bold text-black underline hover:text-primary transition-colors"
          >
            Request withdrawal →
          </Link>
        </div>
      )}
    </div>
  );
}

type DiscoveredStream = { sablier: `0x${string}`; streamId: bigint };

export function NoxPayStreams() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Auto-discovered streams for connected wallet
  const [myStreams, setMyStreams] = useState<DiscoveredStream[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");

  // Manual lookup
  const [lookupSablier, setLookupSablier] = useState<`0x${string}`>(ADDRESSES.SablierV2SepoliaLinear);
  const [lookupId, setLookupId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const validId = lookupId.trim() !== "" && !isNaN(Number(lookupId));

  // Fetch StreamShielded events for the connected wallet
  useEffect(() => {
    if (!address || !publicClient) {
      setMyStreams([]);
      return;
    }

    const fetchStreams = async () => {
      setIsLoadingStreams(true);
      setDiscoveryError("");
      try {
        // Scan from PROXY_DEPLOYMENT_BLOCK to 'latest' for StreamShielded events
        const logs = await publicClient.getLogs({
          address: ADDRESSES.NoxRecipientProxy,
          event: STREAM_SHIELDED_EVENT,
          fromBlock: PROXY_DEPLOYMENT_BLOCK,
          toBlock: "latest",
        });

        const found: DiscoveredStream[] = logs
          .filter(
            (log) =>
              log.args.sender?.toLowerCase() === address.toLowerCase()
          )
          .map((log) => ({
            sablier: log.args.sablier!,
            streamId: log.args.streamId!,
          }))
          // deduplicate by streamId (in case of duplicate events)
          .filter(
            (s, i, arr) =>
              arr.findIndex((x) => x.streamId === s.streamId && x.sablier === s.sablier) === i
          )
          .reverse(); // newest first

        setMyStreams(found);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Graceful fallback: if getLogs range is too large for the RPC, try smaller range
        if (/block range|too large|limit/i.test(msg)) {
          setDiscoveryError(
            "Your RPC limits log queries. Use the manual lookup below or try a different network provider."
          );
        } else {
          setDiscoveryError("Could not fetch your streams. Use the manual lookup below.");
        }
      } finally {
        setIsLoadingStreams(false);
      }
    };

    fetchStreams();
  }, [address, publicClient]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 max-w-4xl"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge-brutal bg-sage text-black border-black font-mono text-xs">
            NoxPay
          </span>
        </div>
        <h1 className="font-heading font-bold text-2xl text-white">My Streams</h1>
        <p className="font-body text-sm text-sage/70 mt-1">
          Shielded payroll streams you created — auto-discovered from on-chain events.
        </p>
      </div>

      {/* Wallet streams */}
      {!address ? (
        <div className="card-brutal bg-white/5 border-2 border-white/10 p-6 text-center">
          <p className="font-body text-sm text-sage/50">Connect your wallet to see your streams.</p>
        </div>
      ) : isLoadingStreams ? (
        <div className="flex items-center gap-3 p-5">
          <div className="w-5 h-5 border-4 border-sage border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="font-body text-sm text-sage/60">Scanning on-chain events for your streams…</p>
        </div>
      ) : discoveryError ? (
        <div className="card-brutal bg-white/5 border-2 border-red-500/30 p-5">
          <p className="font-body text-sm text-red-400">{discoveryError}</p>
        </div>
      ) : myStreams.length > 0 ? (
        <div>
          <p className="font-body font-bold text-xs text-sage/60 uppercase tracking-wide mb-3">
            Your Streams ({myStreams.length})
          </p>
          <div className="space-y-4">
            {myStreams.map((s) => (
              <StreamCard
                key={`${s.sablier}-${s.streamId}`}
                sablier={s.sablier}
                streamId={s.streamId}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="card-brutal bg-white/5 border-2 border-white/10 p-6 text-center space-y-2">
          <p className="font-body text-sm text-sage/50">No shielded streams found for your wallet.</p>
          <Link
            to="/app/noxpay"
            className="font-body text-xs font-bold text-sage underline hover:text-white transition-colors"
          >
            Create your first stream →
          </Link>
        </div>
      )}

      {/* Manual lookup fallback */}
      <div className="card-brutal bg-white border-2 border-black p-6 space-y-4">
        <h2 className="font-heading font-bold text-lg text-black">Look up any stream</h2>
        <p className="font-body text-xs text-black/50">
          Enter a stream ID directly to check its registration status.
        </p>

        <div>
          <label className="block font-body font-bold text-xs text-black mb-1">
            Sablier V2 Contract Address
          </label>
          <input
            type="text"
            value={lookupSablier}
            onChange={(e) => { setLookupSablier(e.target.value as `0x${string}`); setSubmitted(false); }}
            placeholder="0x…"
            className="input-brutal font-mono text-sm"
          />
        </div>

        <div>
          <label className="block font-body font-bold text-xs text-black mb-1">Stream ID</label>
          <input
            type="text"
            value={lookupId}
            onChange={(e) => { setLookupId(e.target.value); setSubmitted(false); }}
            placeholder="e.g. 42"
            className="input-brutal font-mono text-sm"
          />
        </div>

        <button
          onClick={() => setSubmitted(true)}
          disabled={!validId || !isAddress(lookupSablier)}
          className="btn-primary w-full"
        >
          Look Up Stream
        </button>
      </div>

      {submitted && validId && isAddress(lookupSablier) && (
        <StreamCard sablier={lookupSablier} streamId={BigInt(lookupId)} />
      )}
    </motion.div>
  );
}
