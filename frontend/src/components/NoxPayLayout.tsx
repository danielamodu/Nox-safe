import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useConnect, useDisconnect } from "wagmi";

function WrongNetworkBanner() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === sepolia.id) return null;

  return (
    <div className="bg-red-500 border-b-2 border-black px-6 py-3 flex items-center justify-between gap-4">
      <span className="font-body font-bold text-sm text-white">
        Wrong network — NoxPay runs on Sepolia testnet.
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

const NAV_LINKS = [
  { to: "/app/noxpay", label: "Shield Stream" },
  { to: "/app/noxpay/streams", label: "My Streams" },
  { to: "/app/noxpay/withdraw", label: "Withdraw" },
];

const MOBILE_NAV_ITEMS = [
  { to: "/app/noxpay", label: "Shield" },
  { to: "/app/noxpay/streams", label: "My Streams" },
  { to: "/app/noxpay/withdraw", label: "Withdraw" },
];

function NoxPayHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const handleDisconnect = async () => {
    try {
      await disconnectAsync();
    } catch {
      // ignore wallet_revokePermissions RPC error
    }
    navigate("/connect?returnTo=/app/noxpay", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 h-20 bg-sage border-b-2 border-black flex items-center px-4 sm:px-6 gap-3 sm:gap-6">
      {/* Product switcher */}
      <Link
        to="/app/safe"
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-black/10 hover:bg-primary hover:text-black text-black font-body font-bold text-xs transition-all shrink-0"
        style={{ boxShadow: "2px 2px 0px #000" }}
      >
        <svg width="13" height="13" viewBox="0 0 32 32" fill="none">
          <path d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z" fill="currentColor" />
        </svg>
        Nox-Safe
      </Link>

      <div className="w-px h-5 bg-black/20 hidden sm:block" />

      <Link to="/app/noxpay" className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-black rounded-lg flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#8fb88b" strokeWidth="2.5" />
            <path d="M9 12h6M12 9v6" stroke="#8fb88b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="font-heading font-bold text-lg sm:text-xl text-black tracking-tight">
          NoxPay
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-1 flex-1">
        {NAV_LINKS.map(({ to, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`px-4 py-2 rounded-lg font-body font-bold text-sm transition-colors ${
                active ? "bg-black text-sage" : "text-black hover:bg-black/10"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto">
        {isConnected ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="badge-brutal bg-white text-black text-xs font-mono hidden sm:inline-block">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <span className="badge-brutal bg-white text-black text-[11px] font-mono sm:hidden">
              {address?.slice(0, 4)}...{address?.slice(-2)}
            </span>
            <button
              onClick={handleDisconnect}
              className="btn-brutal bg-white text-black text-sm !py-2 !px-4 hover:bg-red-100 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/connect?returnTo=/app/noxpay")}
            className="btn-brutal bg-black text-sage text-sm !py-2 !px-5"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sage border-t-2 border-black px-2 py-2 flex items-center justify-around shadow-lg">
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`px-2.5 py-1.5 rounded-lg font-heading font-bold text-[11px] uppercase tracking-wider transition-all ${
              active ? "bg-black text-sage" : "text-black hover:bg-black/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NoxPayLayout() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  const isAuthPending = isConnecting || isReconnecting;

  useEffect(() => {
    if (!isConnected && !isAuthPending) {
      navigate("/connect?returnTo=/app/noxpay", { replace: true });
    }
  }, [isConnected, isAuthPending, navigate]);

  if (!isConnected && isAuthPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal">
        <div className="w-6 h-6 border-4 border-sage border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConnected) return null;

  return (
    <div className="min-h-screen flex flex-col bg-charcoal">
      <NoxPayHeader />
      <WrongNetworkBanner />
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-6xl mx-auto w-full mb-16 md:mb-0">
        <Outlet />
      </main>
      <MobileBottomNav />
      <footer className="border-t-2 border-black bg-charcoal px-6 py-6 pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-body text-sm text-sage">
            NoxPay — Confidential Payroll Streaming
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
            <span className="font-mono text-xs text-sage/30">|</span>
            <span className="font-mono text-xs text-sage/60">Sepolia Testnet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
