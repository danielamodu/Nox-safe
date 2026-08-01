import { custom } from "viem";

const DRPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// Sign/account methods go to the wallet; everything else (reads, gas) goes to DRPC.
const WALLET_METHODS = new Set([
  "eth_accounts", "eth_requestAccounts", "eth_sign", "eth_signTransaction",
  "eth_signTypedData", "eth_signTypedData_v3", "eth_signTypedData_v4",
  "personal_sign", "eth_sendTransaction", "eth_sendRawTransaction",
  "wallet_switchEthereumChain", "wallet_addEthereumChain",
  "wallet_getPermissions", "wallet_requestPermissions",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeHybridTransport(injected: { request: (args: any) => Promise<unknown> }) {
  return custom({
    async request({ method, params }: { method: string; params?: unknown[] }) {
      if (WALLET_METHODS.has(method)) return injected.request({ method, params });
      const res = await fetch(DRPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? [] }),
      });
      const json = await res.json() as { result?: unknown; error?: { message: string } };
      if (json.error) throw new Error(json.error.message);
      return json.result;
    },
  });
}
