import { useCallback, useEffect, useRef, useState } from "react";
import { getWalletClient } from "wagmi/actions";
import Safe, { EthSafeSignature } from "@safe-global/protocol-kit";
import { config } from "../config/wagmi";
import SafeApiKit from "@safe-global/api-kit";
import { encodeFunctionData } from "viem";
import { ADDRESSES, REGISTRY_ABI } from "../config/contracts";

const CHAIN_ID = 11155111n;

const ENABLE_MODULE_ABI = [
  {
    type: "function",
    name: "enableModule",
    inputs: [{ name: "module", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export type PolicyArgs = {
  whitelistedTargets: string[];
  maxValuePerTx: bigint;
  maxValuePerDay: bigint;
};

export type PendingTx = {
  safeTxHash: string;
  to: string;
  data: string;
  nonce: number;
  confirmations: number;
  confirmationsRequired: number;
  alreadySigned: boolean;
  description: string;
};

function describeData(to: string, data: string, safeAddress: string): string {
  if (to.toLowerCase() === safeAddress.toLowerCase() && data.startsWith("0x610b5925"))
    return "Enable NoxGuardModule";
  if (to.toLowerCase() === ADDRESSES.PolicyRegistry.toLowerCase())
    return "Set Policy";
  return `Call ${to.slice(0, 8)}…`;
}

const ALCHEMY = import.meta.env.VITE_ALCHEMY_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

const SIGN_METHODS = new Set([
  "eth_accounts", "eth_requestAccounts",
  "eth_sign", "eth_signTransaction", "eth_signTypedData",
  "eth_signTypedData_v3", "eth_signTypedData_v4",
  "personal_sign", "eth_sendTransaction",
  "wallet_switchEthereumChain", "wallet_addEthereumChain",
  "wallet_getPermissions", "wallet_requestPermissions",
]);

export function useSafeSetup(safeAddress: string, address: `0x${string}` | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingTxs, setPendingTxs] = useState<PendingTx[]>([]);

  // ── Protocol Kit cache ──────────────────────────────────────────────────────
  // Keyed by "safeAddress:signerAddress" so it's reused across button clicks
  // but recreated if the signer or Safe changes.
  const kitCache = useRef<{ key: string; kit: Safe } | null>(null);
  const kitInFlight = useRef<Promise<Safe> | null>(null);

  const makeProtocolKit = useCallback(async (): Promise<Safe> => {
    if (!address) throw new Error("Wallet not connected");
    const cacheKey = `${safeAddress}:${address}`;

    if (kitCache.current?.key === cacheKey) return kitCache.current.kit;

    // Deduplicate concurrent calls — only one init in flight at a time
    if (kitInFlight.current) return kitInFlight.current;

    const promise = (async () => {
      const wc = await getWalletClient(config, { chainId: 11155111 });
      if (!wc) throw new Error("Wallet not connected");

      // Reads → stable public RPC; signing → connected wallet
      const provider = {
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (SIGN_METHODS.has(method)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return wc.request({ method: method as any, params: params as any });
          }
          const res = await fetch(ALCHEMY, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
          return json.result;
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kit = await Safe.init({ provider: provider as any, signer: address, safeAddress });
      kitCache.current = { key: cacheKey, kit };
      return kit;
    })();

    kitInFlight.current = promise;
    promise.finally(() => { kitInFlight.current = null; });
    return promise;
  }, [safeAddress, address]);

  // Pre-warm: start Safe.init() as soon as we know the safe + signer so the
  // popup appears immediately when the user clicks Sign/Execute.
  useEffect(() => {
    if (safeAddress && address) {
      makeProtocolKit().catch(() => {});
    }
  }, [safeAddress, address, makeProtocolKit]);

  // Invalidate cache when signer changes (wallet switch)
  useEffect(() => {
    kitCache.current = null;
  }, [address]);

  // ── Safe API Kit ────────────────────────────────────────────────────────────
  const apiKitRef = useRef<SafeApiKit | null>(null);
  function getApiKit() {
    if (!apiKitRef.current) apiKitRef.current = new SafeApiKit({ chainId: CHAIN_ID });
    return apiKitRef.current;
  }

  // ── Pending txs ─────────────────────────────────────────────────────────────
  const refreshPendingTxs = useCallback(async (): Promise<PendingTx[]> => {
    if (!safeAddress) return [];
    try {
      const apiKit = getApiKit();
      const result = await apiKit.getPendingTransactions(safeAddress);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txs = (result.results ?? []).map((tx) => ({
        safeTxHash: tx.safeTxHash,
        to: tx.to,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: (tx as any).data ?? "0x",
        nonce: tx.nonce,
        confirmations: tx.confirmations?.length ?? 0,
        confirmationsRequired: tx.confirmationsRequired,
        alreadySigned: address
          ? (tx.confirmations ?? []).some(
              (c) => c.owner.toLowerCase() === address.toLowerCase()
            )
          : false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: describeData(tx.to, (tx as any).data ?? "0x", safeAddress),
      }));
      setPendingTxs(txs);
      return txs;
    } catch (e) {
      console.warn("useSafeSetup: failed to fetch pending txs", e);
      return [];
    }
  }, [safeAddress, address]);

  // ── Core tx submit ──────────────────────────────────────────────────────────
  async function submitSafeTx(to: string, data: string): Promise<{ executed: boolean; safeTxHash: string }> {
    const [protocolKit, apiKit] = await Promise.all([makeProtocolKit(), Promise.resolve(getApiKit())]);

    const threshold = await protocolKit.getThreshold();

    const safeTransaction = await protocolKit.createTransaction({
      transactions: [{ to, value: "0", data }],
    });
    const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
    const signedTx = await protocolKit.signTransaction(safeTransaction);
    const sigs = [...signedTx.signatures.values()];

    if (sigs.length >= threshold) {
      const result = await protocolKit.executeTransaction(signedTx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (result.transactionResponse as any)?.wait?.();
      await refreshPendingTxs();
      return { executed: true, safeTxHash };
    }

    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData: signedTx.data,
      safeTxHash,
      senderAddress: address!,
      senderSignature: sigs[0].data,
    });
    await refreshPendingTxs();
    return { executed: false, safeTxHash };
  }

  const enableModule = useCallback(async (): Promise<{ executed: boolean; safeTxHash: string }> => {
    setIsLoading(true);
    setError("");
    try {
      const data = encodeFunctionData({
        abi: ENABLE_MODULE_ABI,
        functionName: "enableModule",
        args: [ADDRESSES.NoxGuardModule],
      });
      return await submitSafeTx(safeAddress, data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [safeAddress, address]);

  const setPolicy = useCallback(async (args: PolicyArgs): Promise<{ executed: boolean; safeTxHash: string }> => {
    setIsLoading(true);
    setError("");
    try {
      const data = encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "setPolicy",
        args: [{
          whitelistedTargets: args.whitelistedTargets as `0x${string}`[],
          maxValuePerTx: args.maxValuePerTx,
          maxValuePerDay: args.maxValuePerDay,
          active: true,
        }],
      });
      return await submitSafeTx(ADDRESSES.PolicyRegistry, data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [safeAddress, address]);

  const executePending = useCallback(async (safeTxHash: string): Promise<void> => {
    setIsLoading(true);
    setError("");
    try {
      const apiKit = getApiKit();
      // Fetch protocol kit and pending tx in parallel
      const [protocolKit, pendingTx] = await Promise.all([
        makeProtocolKit(),
        apiKit.getTransaction(safeTxHash),
      ]);

      const safeTransaction = await protocolKit.createTransaction({
        transactions: [{
          to: pendingTx.to,
          value: pendingTx.value,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: (pendingTx as any).data ?? "0x",
          operation: pendingTx.operation,
        }],
        options: {
          nonce: pendingTx.nonce,
          safeTxGas: String(pendingTx.safeTxGas ?? 0),
          baseGas: String(pendingTx.baseGas ?? 0),
          gasPrice: String(pendingTx.gasPrice ?? 0),
          gasToken: pendingTx.gasToken || "0x0000000000000000000000000000000000000000",
          refundReceiver: pendingTx.refundReceiver || "0x0000000000000000000000000000000000000000",
        },
      });

      for (const conf of pendingTx.confirmations ?? []) {
        safeTransaction.addSignature(new EthSafeSignature(conf.owner, conf.signature));
      }

      const result = await protocolKit.executeTransaction(safeTransaction);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (result.transactionResponse as any)?.wait?.();
      await refreshPendingTxs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [safeAddress, address, makeProtocolKit, refreshPendingTxs]);

  const signAndExecutePending = useCallback(async (safeTxHash: string): Promise<void> => {
    setIsLoading(true);
    setError("");
    try {
      const apiKit = getApiKit();
      // Fetch protocol kit and pending tx in parallel — cuts ~500ms before popup
      const [protocolKit, pendingTx] = await Promise.all([
        makeProtocolKit(),
        apiKit.getTransaction(safeTxHash),
      ]);

      const safeTransaction = await protocolKit.createTransaction({
        transactions: [{
          to: pendingTx.to,
          value: pendingTx.value,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: (pendingTx as any).data ?? "0x",
          operation: pendingTx.operation,
        }],
        options: {
          nonce: pendingTx.nonce,
          safeTxGas: String(pendingTx.safeTxGas ?? 0),
          baseGas: String(pendingTx.baseGas ?? 0),
          gasPrice: String(pendingTx.gasPrice ?? 0),
          gasToken: pendingTx.gasToken || "0x0000000000000000000000000000000000000000",
          refundReceiver: pendingTx.refundReceiver || "0x0000000000000000000000000000000000000000",
        },
      });

      // Wallet popup appears here
      const signedTx = await protocolKit.signTransaction(safeTransaction);
      const mySig = [...signedTx.signatures.values()].find(
        (s) => s.signer.toLowerCase() === address!.toLowerCase()
      );
      if (!mySig) throw new Error("Failed to produce signature");

      await apiKit.confirmTransaction(safeTxHash, mySig.data);

      const updatedTx = await apiKit.getTransaction(safeTxHash);
      const totalSigs = updatedTx.confirmations?.length ?? 0;

      if (totalSigs >= updatedTx.confirmationsRequired) {
        for (const conf of updatedTx.confirmations ?? []) {
          if (conf.owner.toLowerCase() === address!.toLowerCase()) continue;
          signedTx.addSignature(new EthSafeSignature(conf.owner, conf.signature));
        }
        const result = await protocolKit.executeTransaction(signedTx);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (result.transactionResponse as any)?.wait?.();
      }

      await refreshPendingTxs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [safeAddress, address, makeProtocolKit, refreshPendingTxs]);

  return {
    isLoading,
    error,
    pendingTxs,
    refreshPendingTxs,
    enableModule,
    setPolicy,
    signAndExecutePending,
    executePending,
  };
}
