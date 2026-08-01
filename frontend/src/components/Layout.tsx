import { useEffect, useRef } from "react";
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

export function Layout() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  const isAuthPending = isConnecting || isReconnecting;
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasConnected = useRef(false);

  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true;
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
        redirectTimer.current = null;
      }
      return;
    }
    if (isAuthPending) return;

    // When switching between wallet extensions (e.g. MetaMask → Zerion),
    // window.ethereum re-registers and wagmi can take 2-3 s to pick up the
    // new provider. Give it 3 s if the user was already connected this
    // session; only redirect quickly on a fresh first load (500 ms).
    const delay = wasConnected.current ? 3000 : 500;
    redirectTimer.current = setTimeout(() => {
      navigate("/connect?returnTo=/app/safe", { replace: true });
    }, delay);

    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [isConnected, isAuthPending, navigate]);

  if (!isConnected && isAuthPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConnected) return null;

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
