import { useState } from "react";
import { useAccount, useWalletClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { motion } from "motion/react";
import { createWalletClient, custom, isAddress } from "viem";
import { sepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";
import { ADDRESSES, PROXY_ABI } from "../config/contracts";

const DRPC_URL = "https://sepolia.drpc.org";
const READ_METHODS = new Set([
  "eth_call", "eth_getCode", "eth_chainId", "net_version",
  "eth_blockNumber", "eth_getBalance", "eth_getLogs",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHybridTransport(injected: { request: (args: any) => Promise<unknown> }) {
  return custom({
    async request({ method, params }: { method: string; params?: unknown[] }) {
      if (READ_METHODS.has(method)) {
        const res = await fetch(DRPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
        });
        const json = await res.json() as { result?: unknown; error?: { message: string } };
        if (json.error) throw new Error(json.error.message);
        return json.result;
      }
      return injected.request({ method, params });
    },
  });
}

export function NoxPayCreate() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [sablierAddr, setSablierAddr] = useState<`0x${string}`>(ADDRESSES.SablierV2SepoliaLinear);
  const [streamId, setStreamId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleShield = async () => {
    setError("");
    setStatusMsg("");

    if (!isAddress(sablierAddr)) { setError("Invalid Sablier contract address"); return; }
    if (!streamId || isNaN(Number(streamId))) { setError("Enter a valid numeric stream ID"); return; }
    if (!isAddress(recipient)) { setError("Invalid recipient wallet address"); return; }
    if (!walletClient) { setError("Wallet not connected"); return; }

    try {
      setIsProcessing(true);
      setStatusMsg("Encrypting recipient address with Nox TEE SDK…");

      const hybridClient = createWalletClient({
        chain: sepolia,
        transport: makeHybridTransport(walletClient),
        account: walletClient.account,
      });
      const handleClient = await createViemHandleClient(hybridClient);

      const { handle, handleProof } = await handleClient.encryptInput(
        BigInt(recipient),
        "uint256",
        ADDRESSES.NoxRecipientProxy
      );

      setStatusMsg("Registering shielded stream on-chain…");
      writeContract({
        address: ADDRESSES.NoxRecipientProxy,
        abi: PROXY_ABI,
        functionName: "registerShieldedStream",
        args: [sablierAddr, BigInt(streamId), handle as `0x${string}`, handleProof as `0x${string}`],
      });
    } catch (err: unknown) {
      setError(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-2xl"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge-brutal bg-sage text-black border-black font-mono text-xs">
            NoxPay
          </span>
          <span className="font-mono text-xs text-sage/60">Step 2 of 2</span>
        </div>
        <h1 className="font-heading font-bold text-2xl text-white">Shield a Payroll Stream</h1>
        <p className="font-body text-sm text-sage/70 mt-1">
          Encrypt the recipient's wallet address so it's hidden on-chain until the oracle fulfills
          withdrawal.
        </p>
      </div>

      {/* Pre-step callout */}
      <div className="card-brutal bg-white/5 border-2 border-sage/30 p-5 space-y-2">
        <p className="font-heading font-bold text-sm text-sage">Before you start — Step 1</p>
        <p className="font-body text-xs text-white/60 leading-relaxed">
          Create a Sablier V2 LockupLinear stream on{" "}
          <a
            href="https://app.sablier.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-sage/80 hover:text-sage"
          >
            app.sablier.com
          </a>{" "}
          and set the recipient to{" "}
          <span className="font-mono text-sage/80 break-all">
            {ADDRESSES.NoxRecipientProxy}
          </span>{" "}
          (NoxRecipientProxy). Then come back here to register the encrypted real recipient.
        </p>
      </div>

      {/* Form */}
      <div className="card-brutal bg-white border-2 border-black p-6 space-y-5">
        <h2 className="font-heading font-bold text-lg text-black">Register Encrypted Recipient</h2>

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
          <label className="block font-body font-bold text-xs text-black mb-1">
            Stream ID (NFT token ID from Sablier)
          </label>
          <input
            type="text"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            placeholder="e.g. 101"
            className="input-brutal font-mono text-sm"
          />
        </div>

        <div>
          <label className="block font-body font-bold text-xs text-black mb-1">
            Real Recipient Wallet Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x…"
            className="input-brutal font-mono text-sm"
          />
          <p className="font-body text-xs text-sage mt-1">
            Encrypted into a Nox handle before submission — never sent in plaintext.
          </p>
        </div>

        <button
          onClick={handleShield}
          disabled={!isConnected || isProcessing || isConfirming}
          className="btn-primary w-full py-3 text-base"
        >
          {isProcessing || isConfirming ? "Encrypting & Registering…" : "Encrypt & Shield Stream →"}
        </button>

        {statusMsg && (
          <div className="flex items-start gap-3 p-4 bg-sage/10 border-2 border-black rounded-xl">
            <div className="w-4 h-4 border-4 border-black border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
            <p className="font-body text-sm text-black">{statusMsg}</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-500 rounded-xl">
            <p className="font-body text-sm text-red-700 break-words">{error}</p>
            <button onClick={() => setError("")} className="font-body text-xs text-red-400 mt-1">
              Dismiss
            </button>
          </div>
        )}

        {isSuccess && (
          <div className="p-4 bg-primary/20 border-2 border-black rounded-xl space-y-1">
            <p className="font-heading font-bold text-sm text-black">
              Stream shielded — recipient encrypted on-chain
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
            <p className="font-body text-xs text-black/60 mt-1">
              Go to <strong>Withdraw</strong> to request a shielded withdrawal once funds are vested.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
