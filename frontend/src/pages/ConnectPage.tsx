import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { motion } from "motion/react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};

function NoxSafeIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z"
        fill="#ffe17c"
        stroke="#ffe17c"
        strokeWidth="0.5"
      />
      <path
        d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z"
        fill="#171e19"
      />
    </svg>
  );
}

function NoxPayIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="13" stroke="#8fb88b" strokeWidth="2.5" />
      <path d="M11 16h10M16 11v10" stroke="#8fb88b" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ConnectPage() {
  const { isConnected, address } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const navigate = useNavigate();

  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo") ?? "/products";
  const isNoxPay = returnTo.startsWith("/app/noxpay");

  useEffect(() => {
    if (isConnected) {
      navigate(returnTo, { replace: true });
    }
  }, [isConnected, navigate, returnTo]);

  const accentColor = isNoxPay ? "#8fb88b" : "#ffe17c";
  const glowColor = isNoxPay
    ? "rgba(143,184,139,0.12)"
    : "rgba(255,225,124,0.12)";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "#060c09" }}
    >
      {/* Back link */}
      <Link
        to="/products"
        className="absolute top-6 left-6 font-mono text-xs text-white/30 hover:text-white/60 transition-colors z-10"
      >
        ← Products
      </Link>

      {/* Ambient glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -5%, ${glowColor} 0%, transparent 70%)`,
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(${accentColor} 1px, transparent 1px), linear-gradient(90deg, ${accentColor} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-7 px-6 text-center max-w-sm w-full"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Icon */}
        <motion.div variants={fadeUp}>
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: `0 0 32px ${glowColor}`,
            }}
            animate={{ y: [-6, 6] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          >
            {isNoxPay ? <NoxPayIcon /> : <NoxSafeIcon />}
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div className="space-y-2" variants={fadeUp}>
          <h1 className="font-heading font-bold text-4xl tracking-tight" style={{ color: "#ffffff" }}>
            {isNoxPay ? "NoxPay" : "Nox-Safe"}
          </h1>
          <p className="font-body text-base" style={{ color: "rgba(255,255,255,0.45)" }}>
            {isNoxPay
              ? <>Confidential payroll streaming<br />on Sablier.</>
              : <>Confidential transaction control<br />for your Safe multisig.</>}
          </p>
        </motion.div>

        {/* Connect button */}
        <motion.div className="w-full" variants={fadeUp}>
          {!isConnected ? (
            <motion.button
              onClick={() => connect({ connector: injected() })}
              disabled={isPending}
              className="w-full py-3.5 rounded-xl font-heading font-bold text-base disabled:opacity-60"
              style={{
                background: "#ffffff",
                color: "#060c09",
                boxShadow: `0 0 24px ${glowColor}`,
              }}
              whileHover={{ scale: 1.02, boxShadow: `0 0 36px ${glowColor}` }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {isPending ? "Connecting…" : "Connect Wallet"}
            </motion.button>
          ) : (
            <div className="w-full space-y-3">
              <div
                className="w-full py-3 rounded-xl font-mono text-sm text-center"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}
              >
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </div>
              <button
                onClick={async () => {
                  try {
                    await disconnectAsync();
                  } catch {
                    // Ignore wallet_revokePermissions RPC error
                  }
                }}
                className="w-full py-2.5 rounded-xl font-body text-sm hover:bg-white/5 transition-colors"
                style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Disconnect
              </button>
            </div>
          )}
        </motion.div>

        {/* Footer note */}
        <motion.p
          className="font-mono text-xs"
          style={{ color: "rgba(255,255,255,0.2)" }}
          variants={fadeUp}
        >
          Sepolia Testnet · Powered by iExec Nox TEE
        </motion.p>
      </motion.div>
    </div>
  );
}
