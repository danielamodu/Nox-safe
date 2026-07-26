import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { ADDRESSES, MODULE_ABI } from "../config/contracts";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function OracleBadge() {
  const { data: oracleAddr, isError } = useReadContract({
    address: ADDRESSES.NoxGuardModule,
    abi: MODULE_ABI,
    functionName: "noxOracle",
    query: { staleTime: 60_000 },
  });
  const online = !isError && !!oracleAddr && oracleAddr !== ZERO_ADDR;

  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20 border border-black/30">
      <span className={`w-2 h-2 rounded-full ${online ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
      <span className="font-mono text-xs text-black font-semibold">
        {online ? "Oracle Active" : "Oracle Offline"}
      </span>
    </div>
  );
}

const NAV_LINKS = [
  { to: "/app", label: "Dashboard" },
  { to: "/app/submit", label: "Submit Intent" },
  { to: "/app/sablier", label: "Sablier Shield" },
  { to: "/app/history", label: "History" },
];

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const handleDisconnect = async () => {
    try {
      await disconnectAsync();
    } catch {
      // Ignore wallet_revokePermissions unsupported RPC error from wallet extension
    }
    navigate("/connect", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 h-20 bg-primary border-b-2 border-black flex items-center px-6 gap-6">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z" fill="#ffe17c" stroke="#ffe17c" strokeWidth="1"/>
            <path d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z" fill="#000"/>
          </svg>
        </div>
        <span className="font-heading font-bold text-xl text-black tracking-tight">
          Nox-Safe
        </span>
      </Link>

      {/* Nav */}
      <nav className="hidden md:flex items-center gap-1 flex-1">
        {NAV_LINKS.map(({ to, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`px-4 py-2 rounded-lg font-body font-bold text-sm transition-colors ${
                active
                  ? "bg-black text-primary"
                  : "text-black hover:bg-black/10"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Oracle badge */}
      <OracleBadge />

      {/* Wallet */}
      <div className="ml-auto">
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="badge-brutal bg-white text-black text-xs font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
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
            onClick={() => navigate("/connect")}
            className="btn-primary text-sm !py-2 !px-5"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
