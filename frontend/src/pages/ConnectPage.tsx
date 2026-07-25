import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

export function ConnectPage() {
  const { isConnected, address } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();

  useEffect(() => {
    if (isConnected) navigate("/app", { replace: true });
  }, [isConnected, navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "#060c09" }}
    >
      {/* Ambient glow — breathes via motion */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(255,225,124,0.12) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,225,124,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,225,124,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-7 px-6 text-center max-w-sm w-full"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Floating icon — floats via motion */}
        <motion.div variants={fadeUp}>
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 0 32px rgba(255,225,124,0.08)",
            }}
            animate={{ y: [-6, 6] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          >
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
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div className="space-y-2" variants={fadeUp}>
          <h1 className="font-heading font-bold text-4xl tracking-tight" style={{ color: "#ffffff" }}>
            Nox-Safe
          </h1>
          <p className="font-body text-base" style={{ color: "rgba(255,255,255,0.45)" }}>
            Confidential transaction control<br />for your Safe multisig.
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
                boxShadow: "0 0 24px rgba(255,225,124,0.15)",
              }}
              whileHover={{ scale: 1.02, boxShadow: "0 0 36px rgba(255,225,124,0.25)" }}
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
                onClick={() => disconnect()}
                className="w-full py-2.5 rounded-xl font-body text-sm"
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
