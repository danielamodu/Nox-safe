import { Link } from "react-router-dom";
import { motion } from "motion/react";

export function ProductSelect() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#060c09" }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(255,225,124,0.10) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 w-full max-w-4xl mx-auto py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-2"
        >
          <Link
            to="/"
            className="font-mono text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            ← Back to home
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mb-10"
        >
          <h1 className="font-heading font-bold text-3xl text-white mt-6 mb-2">
            Choose a product
          </h1>
          <p className="font-body text-white/40 text-sm">
            Sepolia testnet · Powered by iExec Nox TEE
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* NOX-SAFE */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="flex flex-col p-8 rounded-2xl border-2 border-white/10 bg-white/[0.04] hover:border-primary/50 hover:bg-white/[0.07] transition-all duration-200"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center border-2 border-black shrink-0">
                  <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                    <path
                      d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z"
                      fill="#000"
                    />
                    <path
                      d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z"
                      fill="#ffe17c"
                    />
                  </svg>
                </div>
                <span className="font-heading font-bold text-xl text-white tracking-tight">
                  NOX-SAFE
                </span>
              </div>

              <p className="font-body font-semibold text-white/85 text-sm mb-3">
                Confidential treasury execution for Safe multisig
              </p>
              <p className="font-body text-sm text-white/40 leading-relaxed mb-8">
                Hide transaction target and value until execution. Built for DAOs, funds, and
                companies managing on-chain treasury.
              </p>
            </div>

            <Link
              to="/app/safe"
              className="w-full py-3 rounded-xl font-heading font-bold text-sm text-center bg-primary text-black border-2 border-black transition-all hover:opacity-90"
              style={{ boxShadow: "3px 3px 0px 0px #000" }}
            >
              Enter Nox-Safe →
            </Link>
          </motion.div>

          {/* NOXPAY */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col p-8 rounded-2xl border-2 border-white/10 bg-white/[0.04] hover:border-sage/50 hover:bg-white/[0.07] transition-all duration-200"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-sage flex items-center justify-center border-2 border-black shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#000" strokeWidth="2.5" />
                    <path
                      d="M9 12h6M12 9v6"
                      stroke="#000"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <span className="font-heading font-bold text-xl text-white tracking-tight">
                  NOXPAY
                </span>
              </div>

              <p className="font-body font-semibold text-white/85 text-sm mb-3">
                Confidential payroll streaming on Sablier
              </p>
              <p className="font-body text-sm text-white/40 leading-relaxed mb-8">
                Shield employee wallet addresses from public view. Built for companies paying
                contributors on-chain.
              </p>
            </div>

            <Link
              to="/app/pay"
              className="w-full py-3 rounded-xl font-heading font-bold text-sm text-center bg-sage text-black border-2 border-black transition-all hover:opacity-90"
              style={{ boxShadow: "3px 3px 0px 0px #000" }}
            >
              Enter NoxPay →
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
