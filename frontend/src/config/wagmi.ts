import { createConfig, http, fallback } from "wagmi";
import { sepolia } from "wagmi/chains";
import { coinbaseWallet, injected, safe, walletConnect } from "wagmi/connectors";

const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID;

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    safe(),
    injected(),
    ...(WC_PROJECT_ID ? [walletConnect({ projectId: WC_PROJECT_ID })] : []),
    coinbaseWallet({ appName: "Nox-Safe" }),
  ],
  transports: {
    [sepolia.id]: fallback([
      http("https://sepolia.drpc.org"),
      http("https://ethereum-sepolia-rpc.publicnode.com"),
      http("https://rpc.ankr.com/eth_sepolia"),
    ]),
  },
});

