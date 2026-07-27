import { useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import { motion } from "motion/react";
import { isAddress } from "viem";
import { ADDRESSES, PROXY_ABI } from "../config/contracts";

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

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
      <div className="flex items-center justify-between gap-3">
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
              stream.active ? "bg-green-100 text-green-800 border-green-800" : "bg-gray-100 text-gray-600 border-gray-400"
            }`}
          >
            {stream.active ? "Active" : "Inactive"}
          </span>
        )}
      </div>

      {isLoading && (
        <p className="font-body text-xs text-black/50">Loading stream info…</p>
      )}

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
            to="/app/pay/withdraw"
            className="font-body text-xs font-bold text-black underline hover:text-primary transition-colors"
          >
            Request withdrawal →
          </Link>
        </div>
      )}
    </div>
  );
}

export function NoxPayStreams() {
  const { address } = useAccount();
  const [lookupSablier, setLookupSablier] = useState<`0x${string}`>(ADDRESSES.SablierV2SepoliaLinear);
  const [lookupId, setLookupId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const validId = lookupId.trim() !== "" && !isNaN(Number(lookupId));

  const handleLookup = () => {
    if (!validId) return;
    setSubmitted(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 max-w-2xl"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge-brutal bg-sage text-black border-black font-mono text-xs">
            NoxPay
          </span>
        </div>
        <h1 className="font-heading font-bold text-2xl text-white">My Streams</h1>
        <p className="font-body text-sm text-sage/70 mt-1">
          Look up any shielded stream by ID to check its registration status and sender details.
        </p>
      </div>

      {/* Demo stream */}
      {ADDRESSES.DemoStreamId && (
        <div>
          <p className="font-body font-bold text-xs text-sage/60 uppercase tracking-wide mb-3">
            Live Demo Stream
          </p>
          <StreamCard
            sablier={ADDRESSES.SablierV2SepoliaLinear}
            streamId={BigInt(ADDRESSES.DemoStreamId)}
            label="Demo"
          />
        </div>
      )}

      {/* Lookup form */}
      <div className="card-brutal bg-white border-2 border-black p-6 space-y-4">
        <h2 className="font-heading font-bold text-lg text-black">Look up a stream</h2>

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
            placeholder="e.g. 3487"
            className="input-brutal font-mono text-sm"
          />
        </div>

        <button
          onClick={handleLookup}
          disabled={!validId || !isAddress(lookupSablier)}
          className="btn-primary w-full"
        >
          Look Up Stream
        </button>
      </div>

      {submitted && validId && isAddress(lookupSablier) && (
        <StreamCard
          sablier={lookupSablier}
          streamId={BigInt(lookupId)}
        />
      )}

      {!address && (
        <p className="font-body text-xs text-sage/50 text-center">
          Connect your wallet to see streams associated with your address.
        </p>
      )}
    </motion.div>
  );
}
