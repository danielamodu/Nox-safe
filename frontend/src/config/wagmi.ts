import { createConfig, http, fallback } from "wagmi";
import { sepolia } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID ?? "";

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),                                        // MetaMask, Zerion extension, Rabby, etc.
    walletConnect({ projectId: WC_PROJECT_ID }),       // WalletConnect v2 (mobile wallets)
    coinbaseWallet({ appName: "Nox-Safe" }),           // Coinbase Wallet
  ],
  transports: {
    [sepolia.id]: fallback([
      http("https://sepolia.drpc.org"),
      http("https://ethereum-sepolia-rpc.publicnode.com"),
      http("https://rpc.ankr.com/eth_sepolia"),
    ]),
  },
});

