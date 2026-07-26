import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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

const MOBILE_NAV_ITEMS = [
  { to: "/app", label: "Dashboard", icon: "📊" },
  { to: "/app/submit", label: "Submit", icon: "🔒" },
  { to: "/app/sablier", label: "Sablier", icon: "🛡️" },
  { to: "/app/history", label: "History", icon: "📜" },
];

function MobileBottomNav() {
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-primary border-t-2 border-black px-2 py-2 flex items-center justify-around shadow-lg">
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              active ? "bg-black text-primary font-bold" : "text-black hover:bg-black/10"
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="font-heading text-[11px] uppercase tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  useEffect(() => {
    if (!isConnected && !isConnecting && !isReconnecting) {
      navigate("/connect", { replace: true });
    }
  }, [isConnected, isConnecting, isReconnecting, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-charcoal">
      <Header />
      <WrongNetworkBanner />
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-6xl mx-auto w-full mb-16 md:mb-0">
        <Outlet />
      </main>
      <MobileBottomNav />
      <footer className="border-t-2 border-black bg-charcoal px-6 py-6 pb-20 md:pb-6">
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
