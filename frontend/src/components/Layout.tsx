import { Outlet } from "react-router-dom";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Header } from "./Header";

function WrongNetworkBanner() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === sepolia.id) return null;

  return (
    <div className="bg-red-500 border-b-2 border-black px-6 py-3 flex items-center justify-between gap-4">
      <span className="font-body font-bold text-sm text-white">
        Wrong network — Nox-Safe runs on Sepolia testnet.
      </span>
      <button
        onClick={() => switchChain({ chainId: sepolia.id })}
        disabled={isPending}
        className="shrink-0 bg-white text-red-600 font-body font-bold text-sm px-4 py-1.5 rounded-lg border-2 border-black disabled:opacity-60"
        style={{ boxShadow: "2px 2px 0px #000" }}
      >
        {isPending ? "Switching…" : "Switch to Sepolia"}
      </button>
    </div>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-charcoal">
      <Header />
      <WrongNetworkBanner />
      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
      <footer className="border-t-2 border-black bg-charcoal px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-body text-sm text-sage">
            Nox-Safe — Confidential Transaction Guard
          </span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/danielamodu" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-sage/70 hover:text-primary transition-colors">
              GitHub (@danielamodu)
            </a>
            <a href="https://x.com/szrxbt" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-sage/70 hover:text-primary transition-colors">
              Twitter (@szrxbt)
            </a>
            <span className="font-mono text-xs text-sage/30">|</span>
            <span className="font-mono text-xs text-sage/60">
              Sepolia Testnet
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
