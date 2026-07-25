import { useState } from "react";
import {
  useAccount,
  useWalletClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { motion } from "motion/react";
import { createWalletClient, custom, isAddress, parseEther } from "viem";
import { sepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";
import { ADDRESSES, MODULE_ABI } from "../config/contracts";
import { useSafe } from "../hooks/useSafe";

const DRPC_URL = "https://sepolia.drpc.org";
const READ_METHODS = new Set([
  "eth_call", "eth_getCode", "eth_chainId", "net_version",
  "eth_blockNumber", "eth_getBalance", "eth_getLogs",
]);

// Routes reads through drpc (avoids MetaMask RPC issues with eth_call),
// routes signing through the injected wallet (MetaMask).
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

type Step = "form" | "encrypting" | "submitting" | "done";

export function SubmitIntent() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { safeAddress } = useSafe();
  const hasSafe = safeAddress.length === 42;

  const [step, setStep] = useState<Step>("form");
  const [target, setTarget] = useState("");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");
  const [error, setError] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSubmit = async () => {
    setError("");

    if (!isAddress(target)) {
      setError("Invalid target address");
      return;
    }
    if (!/^0x[0-9a-fA-F]*$/.test(data)) {
      setError("Calldata must be valid hex (0x or 0xabcdef...)");
      return;
    }
    if (!walletClient) {
      setError("Wallet not ready");
      return;
    }

    let valueWei: bigint;
    try {
      valueWei = parseEther(value || "0");
    } catch {
      setError("Invalid ETH value");
      return;
    }

    try {
      setStep("encrypting");

      // Use a hybrid client: reads go through drpc (avoids MetaMask RPC eth_call issues),
      // signing goes through the injected wallet.
      const hybridClient = createWalletClient({
        chain: sepolia,
        transport: makeHybridTransport(walletClient),
        account: walletClient.account,
      });
      const handleClient = await createViemHandleClient(hybridClient);
      const moduleAddr = ADDRESSES.NoxGuardModule;

      const targetAsUint256 = BigInt(target);

      const [
        { handle: targetHandle, handleProof: targetProof },
        { handle: valueHandle, handleProof: valueProof },
      ] = await Promise.all([
        handleClient.encryptInput(targetAsUint256, "uint256", moduleAddr),
        handleClient.encryptInput(valueWei, "uint256", moduleAddr),
      ]);

      setStep("submitting");
      writeContract(
        {
          address: ADDRESSES.NoxGuardModule,
          abi: MODULE_ABI,
          functionName: "submitIntent",
          args: [
            safeAddress as `0x${string}`,
            targetHandle as `0x${string}`,
            targetProof as `0x${string}`,
            valueHandle as `0x${string}`,
            valueProof as `0x${string}`,
            (data || "0x") as `0x${string}`,
          ],
        },
        {
          onSuccess: () => setStep("done"),
          onError: (err) => {
            setError(err.message);
            setStep("form");
          },
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/chain.*does not match|wrong.*chain|chain.*mismatch/i.test(msg))
        setError("Wrong network — please switch your wallet to Sepolia testnet.");
      else if (/user rejected|user denied|rejected the request/i.test(msg))
        setError("Transaction cancelled.");
      else if (/insufficient funds/i.test(msg))
        setError("Insufficient funds in your wallet.");
      else
        setError("Something went wrong. Please try again.");
      setStep("form");
    }
  };

  if (!isConnected) {
    return (
      <div className="card-brutal card-brutal-lg bg-primary dot-pattern text-center py-16">
        <h2 className="font-heading font-bold text-2xl text-black">
          Connect wallet to submit intents
        </h2>
      </div>
    );
  }

  if (!hasSafe) {
    return (
      <div className="card-brutal text-center py-12">
        <h2 className="font-heading font-bold text-xl mb-2">
          No Safe configured
        </h2>
        <p className="font-body text-gray-500">
          Go to Dashboard and enter your Safe address first.
        </p>
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
          Send Private Transaction
        </h1>
        <p className="font-body text-sage mt-2">
          Your recipient and amount are encrypted before leaving your browser — only the oracle can read them.
        </p>
      </div>

      {/* Form */}
      {step === "form" && (
        <motion.div
          className="card-brutal card-brutal-lg space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <h2 className="font-heading font-bold text-xl">
            Transaction Details
          </h2>

          <div>
            <label className="font-body font-bold text-sm block mb-1">
              Recipient Address
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0x..."
              className="input-brutal font-mono text-sm"
            />
          </div>

          <div>
            <label className="font-body font-bold text-sm block mb-1">
              Amount (ETH)
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.0"
              className="input-brutal font-mono text-sm"
            />
          </div>

          <div>
            <label className="font-body font-bold text-sm block mb-1">
              Calldata (optional, hex)
            </label>
            <input
              type="text"
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="0x"
              className="input-brutal font-mono text-sm"
            />
          </div>

          {error && <p className="text-red-500 font-body text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            className="btn-primary btn-brutal-lg"
          >
            Send Transaction
          </button>
        </motion.div>
      )}

      {/* Encrypting */}
      {step === "encrypting" && (
        <motion.div
          className="card-brutal card-brutal-lg text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="font-heading font-bold text-xl mb-2">
            Encrypting with Nox TEE...
          </h2>
          <p className="font-body text-gray-500 text-sm">
            Target and value are being encrypted inside the TEE. This takes a moment.
          </p>
        </motion.div>
      )}

      {/* Submitting */}
      {step === "submitting" && (
        <motion.div
          className="card-brutal card-brutal-lg text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="font-heading font-bold text-xl mb-2">
            {isPending ? "Confirm in Wallet..." : "Waiting for Confirmation..."}
          </h2>
          {isConfirming && txHash && (
            <p className="font-mono text-xs text-gray-400">
              tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </p>
          )}
        </motion.div>
      )}

      {/* Done */}
      {(step === "done" || isSuccess) && (
        <motion.div
          className="card-brutal card-brutal-lg bg-yellow-50 border-yellow-400 text-center py-12"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-12 h-12 bg-primary border-2 border-black rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" fill="black" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-heading font-bold text-xl mb-2 text-black">
            Transaction Queued
          </h2>
          <p className="font-body text-gray-700 mb-2">
            Your encrypted transaction was broadcast to the blockchain.
          </p>
          <p className="font-body text-sm text-gray-500 mb-4">
            The oracle is now validating it against your spending rules. Check{" "}
            <strong>Transaction History</strong> in ~15 seconds to see the result.
          </p>
          {txHash && (
            <p className="font-mono text-xs text-gray-400 break-all px-4 mb-2">
              tx: {txHash}
            </p>
          )}
          <button
            onClick={() => {
              setStep("form");
              setTarget("");
              setValue("0");
              setData("0x");
              setError("");
            }}
            className="btn-accent mt-4"
          >
            Send Another
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
