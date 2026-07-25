import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

// Get a free project ID at https://cloud.walletconnect.com
const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID ?? "b8a1daa2a6b8d0b56c2e3f4a7890abcd";

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),                                        // MetaMask, Zerion extension, Rabby, etc.
    walletConnect({ projectId: WC_PROJECT_ID }),       // WalletConnect v2 (mobile wallets)
    coinbaseWallet({ appName: "Nox-Safe" }),           // Coinbase Wallet
  ],
  transports: {
    [sepolia.id]: http("https://sepolia.drpc.org"),
  },
});
