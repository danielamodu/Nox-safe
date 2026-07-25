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

type TabMode = "shield" | "withdraw";

export function SablierShield() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [tab, setTab] = useState<TabMode>("shield");

  // Form State
  const [sablierAddr, setSablierAddr] = useState<`0x${string}`>(ADDRESSES.SablierV2SepoliaLinear);
  const [streamId, setStreamId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleRegisterShield = async () => {
    setError("");
    setStatusMsg("");

    if (!isAddress(sablierAddr)) {
      setError("Invalid Sablier contract address");
      return;
    }
    if (!streamId || isNaN(Number(streamId))) {
      setError("Please enter a valid numeric stream ID");
      return;
    }
    if (!isAddress(recipient)) {
      setError("Invalid real recipient wallet address");
      return;
    }
    if (!walletClient) {
      setError("Wallet not connected");
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMsg("Encrypting recipient address with Nox TEE SDK...");

      const hybridClient = createWalletClient({
        chain: sepolia,
        transport: makeHybridTransport(walletClient),
        account: walletClient.account,
      });
      const handleClient = await createViemHandleClient(hybridClient);
      const proxyContract = ADDRESSES.NoxRecipientProxy;

      const recipientAsUint256 = BigInt(recipient);
      const { handle, handleProof } = await handleClient.encryptInput(
        recipientAsUint256,
        "uint256",
        proxyContract
      );

      setStatusMsg("Submitting Nox-shielded stream registration to Sepolia...");
      writeContract({
        address: proxyContract,
        abi: PROXY_ABI,
        functionName: "registerShieldedStream",
        args: [
          sablierAddr,
          BigInt(streamId),
          handle as `0x${string}`,
          handleProof as `0x${string}`,
        ],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Shielding failed: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestWithdraw = async () => {
    setError("");
    setStatusMsg("");

    if (!isAddress(sablierAddr)) {
      setError("Invalid Sablier contract address");
      return;
    }
    if (!streamId || isNaN(Number(streamId))) {
      setError("Please enter a valid numeric stream ID");
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMsg("Submitting shielded withdrawal request...");

      writeContract({
        address: ADDRESSES.NoxRecipientProxy,
        abi: PROXY_ABI,
        functionName: "requestShieldedWithdraw",
        args: [sablierAddr, BigInt(streamId)],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Withdrawal request failed: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {/* Header Banner */}
      <div className="card-brutal bg-cream border-2 border-black p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-brutal bg-purple-200 text-purple-900 border-black font-mono text-xs">
              Nox-Sablier V2
            </span>
            <span className="font-mono text-xs text-charcoal/60">Shielded Recipient Wrapper</span>
          </div>
          <h1 className="font-heading font-bold text-2xl text-black mt-1">
            Sablier V2 Privacy Shield
          </h1>
          <p className="font-body text-sm text-charcoal/80 mt-1 max-w-2xl">
            Shield the on-chain link between public Sablier streaming payrolls and recipient wallets.
            The actual recipient is encrypted via Nox TEE and validated by oracle gateway proofs upon withdrawal.
          </p>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="card-brutal bg-white border-2 border-black p-6 space-y-6">
        {/* Tab Selection */}
        <div className="flex border-b-2 border-black pb-4 gap-4">
          <button
            onClick={() => setTab("shield")}
            className={`px-4 py-2 rounded-lg font-body font-bold text-sm border-2 border-black transition-all ${
              tab === "shield" ? "bg-primary text-black" : "bg-cream text-charcoal"
            }`}
            style={{ boxShadow: tab === "shield" ? "2px 2px 0px #000" : "none" }}
          >
            1. Shield Sablier Stream (Sender)
          </button>
          <button
            onClick={() => setTab("withdraw")}
            className={`px-4 py-2 rounded-lg font-body font-bold text-sm border-2 border-black transition-all ${
              tab === "withdraw" ? "bg-primary text-black" : "bg-cream text-charcoal"
            }`}
            style={{ boxShadow: tab === "withdraw" ? "2px 2px 0px #000" : "none" }}
          >
            2. Request Withdrawal (Recipient)
          </button>
        </div>

        {tab === "shield" ? (
          <div className="space-y-5">
            <h2 className="font-heading font-bold text-lg text-black">
              Register Encrypted End-Recipient
            </h2>
            <p className="font-body text-xs text-charcoal/70">
              Only the stream sender (Sablier creator) can register the encrypted recipient address.
            </p>

            <div>
              <label className="block font-body font-bold text-xs text-black mb-1">
                Sablier V2 Contract Address (Sepolia)
              </label>
              <input
                type="text"
                value={sablierAddr}
                onChange={(e) => setSablierAddr(e.target.value as `0x${string}`)}
                placeholder="0x..."
                className="w-full font-mono text-sm px-4 py-2.5 bg-cream border-2 border-black rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-body font-bold text-xs text-black mb-1">
                Sablier Stream ID (NFT Token ID)
              </label>
              <input
                type="text"
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                placeholder="e.g. 101"
                className="w-full font-mono text-sm px-4 py-2.5 bg-cream border-2 border-black rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-body font-bold text-xs text-black mb-1">
                Real End-Recipient Wallet Address (Encrypted via Nox)
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full font-mono text-sm px-4 py-2.5 bg-cream border-2 border-black rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="font-mono text-xs text-purple-700 mt-1">
                🔒 Will be encrypted into a Nox handle before submission.
              </p>
            </div>

            <button
              onClick={handleRegisterShield}
              disabled={!isConnected || isProcessing || isConfirming}
              className="btn-primary w-full py-3 text-base"
            >
              {isProcessing || isConfirming
                ? "Processing Nox Encryption & Submission..."
                : "Encrypt & Shield Stream"}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <h2 className="font-heading font-bold text-lg text-black">
              Claim Shielded Sablier Stream
            </h2>
            <p className="font-body text-xs text-charcoal/70">
              Submit a withdrawal request. The Nox TEE oracle will decrypt your registered recipient handle and release funds directly from Sablier to your wallet.
            </p>

            <div>
              <label className="block font-body font-bold text-xs text-black mb-1">
                Sablier V2 Contract Address
              </label>
              <input
                type="text"
                value={sablierAddr}
                onChange={(e) => setSablierAddr(e.target.value as `0x${string}`)}
                placeholder="0x..."
                className="w-full font-mono text-sm px-4 py-2.5 bg-cream border-2 border-black rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-body font-bold text-xs text-black mb-1">
                Sablier Stream ID
              </label>
              <input
                type="text"
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                placeholder="e.g. 101"
                className="w-full font-mono text-sm px-4 py-2.5 bg-cream border-2 border-black rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              onClick={handleRequestWithdraw}
              disabled={!isConnected || isProcessing || isConfirming}
              className="btn-primary w-full py-3 text-base"
            >
              {isProcessing || isConfirming ? "Submitting Request..." : "Request Shielded Withdrawal"}
            </button>
          </div>
        )}

        {/* Status & Alerts */}
        {statusMsg && (
          <div className="p-4 bg-blue-50 border-2 border-black rounded-lg text-blue-900 font-mono text-xs">
            ℹ️ {statusMsg}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border-2 border-black rounded-lg text-red-900 font-mono text-xs">
            ⚠️ {error}
          </div>
        )}

        {isSuccess && (
          <div className="p-4 bg-green-50 border-2 border-black rounded-lg text-green-900 font-mono text-xs">
            ✅ Transaction confirmed on Sepolia! Tx: {txHash?.slice(0, 10)}...{txHash?.slice(-8)}
          </div>
        )}
      </div>
    </motion.div>
  );
}
