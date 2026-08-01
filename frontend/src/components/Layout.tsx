import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAccount, useChainId, useSwitchChain, useConnect } from "wagmi";
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
  { to: "/app/safe", label: "Dashboard" },
  { to: "/app/safe/submit", label: "Submit" },
  { to: "/app/safe/history", label: "History" },
  { to: "/app/safe/policy", label: "Policy" },
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
            className={`px-2.5 py-1.5 rounded-lg font-heading font-bold text-[11px] uppercase tracking-wider transition-all ${
              active
                ? "bg-black text-primary"
                : "text-black hover:bg-black/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ReconnectBanner() {
  const { connect, connectors } = useConnect();

  // Auto-attempt reconnect as soon as a new provider is available
  useEffect(() => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injected) connect({ connector: injected });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-charcoal border-b-2 border-primary/40 px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse border border-black" />
        <span className="font-body font-bold text-sm text-sage">
          Switching wallet…
        </span>
      </div>
      <button
        onClick={() => {
          const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
          if (injected) connect({ connector: injected });
        }}
        className="shrink-0 bg-primary text-black font-body font-bold text-xs px-3 py-1.5 rounded border-2 border-black"
        style={{ boxShadow: "2px 2px 0px #000" }}
      >
        Reconnect
      </button>
    </div>
  );
}

export function Layout() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  const isAuthPending = isConnecting || isReconnecting;

  // Persist across wallet-switch re-renders using sessionStorage
  const wasConnected = useRef(
    typeof sessionStorage !== "undefined" && sessionStorage.getItem("nox-was-connected") === "1"
  );

  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true;
      sessionStorage.setItem("nox-was-connected", "1");
    }
  }, [isConnected]);

  // Fresh visitor who has never connected → redirect to /connect
  useEffect(() => {
    if (!isConnected && !isAuthPending && !wasConnected.current) {
      navigate("/connect?returnTo=/app/safe", { replace: true });
    }
  }, [isConnected, isAuthPending, navigate]);

  // Initial reconnect spinner (page load, never been connected yet)
  if (!isConnected && isAuthPending && !wasConnected.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Mid-session disconnect (wallet switch) → keep the app mounted, show banner
  const showReconnectBanner = !isConnected && wasConnected.current;

  return (
    <div className="min-h-screen flex flex-col bg-charcoal">
      <Header />
      {showReconnectBanner ? <ReconnectBanner /> : <WrongNetworkBanner />}
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
            <a
              href="https://github.com/danielamodu/Nox-safe"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-sage/70 hover:text-primary transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/szrxbt"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-sage/70 hover:text-primary transition-colors"
            >
              Twitter (@szrxbt)
            </a>
            <span className="font-mono text-xs text-sage/30">|</span>
            <span className="font-mono text-xs text-sage/60">Sepolia Testnet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
