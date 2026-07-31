import { Link } from "react-router-dom";
import { motion } from "motion/react";

export function NoxPayLanding() {
  return (
    <div className="min-h-screen bg-charcoal flex flex-col">
      <header className="h-16 bg-charcoal border-b-2 border-white/10 flex items-center px-6 gap-4">
        <Link
          to="/products"
          className="font-body text-xs text-sage/60 hover:text-sage transition-colors"
        >
          ← Products
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 bg-sage rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="black" strokeWidth="2.5" />
              <path d="M9 12h6M12 9v6" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-heading font-bold text-lg text-white">NoxPay</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="max-w-2xl w-full space-y-10"
        >
          <div className="text-center space-y-3">
            <span className="badge-brutal bg-sage text-black border-black font-mono text-xs inline-block">
              NoxPay
            </span>
            <h1 className="font-heading font-bold text-3xl sm:text-4xl text-white">
              Confidential Payroll Streaming
            </h1>
            <p className="font-body text-sm text-sage/60 max-w-md mx-auto">
              Sablier payroll streams where the recipient's wallet is encrypted on-chain via Nox TEE —
              only the oracle can reveal who gets paid.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Link to="/app/noxpay/company" className="group block">
              <div
                className="card-brutal bg-white border-2 border-black p-7 space-y-4 h-full transition-transform group-hover:-translate-y-0.5"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                <div className="w-10 h-10 bg-primary border-2 border-black rounded-lg flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="6" width="18" height="14" rx="2" stroke="black" strokeWidth="2" />
                    <path d="M8 6V4h8v2" stroke="black" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 12h8M8 16h5" stroke="black" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-heading font-bold text-xl text-black">I'm a Company</p>
                  <p className="font-body text-sm text-black/60 mt-1">
                    Create and manage shielded payroll streams for your team.
                  </p>
                </div>
                <p className="font-body font-bold text-xs text-black/40 uppercase tracking-wide">
                  Create streams · View my streams →
                </p>
              </div>
            </Link>

            <Link to="/app/noxpay/employee" className="group block">
              <div
                className="card-brutal bg-sage border-2 border-black p-7 space-y-4 h-full transition-transform group-hover:-translate-y-0.5"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                <div className="w-10 h-10 bg-black border-2 border-black rounded-lg flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="#8fb88b" strokeWidth="2" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#8fb88b" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-heading font-bold text-xl text-black">I'm an Employee</p>
                  <p className="font-body text-sm text-black/70 mt-1">
                    Withdraw from a shielded payroll stream your employer set up for you.
                  </p>
                </div>
                <p className="font-body font-bold text-xs text-black/50 uppercase tracking-wide">
                  Enter stream ID · Request withdrawal →
                </p>
              </div>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
