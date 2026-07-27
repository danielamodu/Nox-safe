import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = (delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: delay } },
});

const slideLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const slideRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const FEATURES = [
  {
    title: "Encrypted Intents",
    desc: "Transaction parameters are encrypted with iExec Nox handles. Nobody sees what you're doing until it's done.",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="black" strokeWidth="2.5" />
        <path d="M7 11V7a5 5 0 0110 0v4" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    bg: "bg-primary",
  },
  {
    title: "TEE Validation",
    desc: "A Trusted Execution Environment decrypts and validates your transaction against on-chain policy — without trusting the operator.",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="black" strokeWidth="2.5" />
        <path d="M9 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    bg: "bg-sage",
  },
  {
    title: "On-Chain Policy",
    desc: "Spending caps, whitelisted targets, daily limits — all enforced by the smart contract, not by promises.",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="black" strokeWidth="2.5" />
        <path d="M14 2v6h6M9 15h6M9 11h6" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    bg: "bg-white",
  },
  {
    title: "Safe Multisig",
    desc: "Built as a Safe module. Your multisig stays in control — Nox-Safe is an extension, not a replacement.",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="black" strokeWidth="2.5" />
        <circle cx="12" cy="12" r="3" stroke="black" strokeWidth="2.5" />
        <path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="black" strokeWidth="2" />
      </svg>
    ),
    bg: "bg-primary",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Set your policy",
    desc: "Configure spending limits and whitelisted targets via your Safe multisig.",
  },
  {
    num: "02",
    title: "Encrypt your transaction",
    desc: "Enter the recipient and amount. The app encrypts both using iExec Nox — only the TEE can read them.",
  },
  {
    num: "03",
    title: "Submit on-chain",
    desc: "Submit the encrypted transaction on-chain. It's recorded on the blockchain but completely unreadable.",
  },
  {
    num: "04",
    title: "TEE validates & executes",
    desc: "The Nox oracle decrypts inside a TEE, checks policy, and executes — or rejects — the transaction.",
  },
];

const STATS = [
  { value: "0", label: "Trust Assumptions", sub: "On-chain policy enforced" },
  { value: "100%", label: "Confidential", sub: "Encrypted until execution" },
  { value: "~30s", label: "TEE Latency", sub: "Decrypt → validate → execute" },
];

const COMPARE = {
  before: [
    { label: "Transaction params", value: "Publicly visible on-chain" },
    { label: "MEV exposure", value: "Frontrunnable by anyone" },
    { label: "Privacy", value: "None — all data is readable" },
    { label: "Policy enforcement", value: "Social trust / off-chain" },
  ],
  after: [
    { label: "Transaction params", value: "Encrypted until TEE execution" },
    { label: "MEV exposure", value: "Invisible until confirmed" },
    { label: "Privacy", value: "End-to-end confidential" },
    { label: "Policy enforcement", value: "On-chain smart contract" },
  ],
};

const FAQS = [
  {
    q: "What happens if the oracle goes down?",
    a: "Your funds stay safe. The oracle can only fulfill or reject intents — it can never move funds outside of policy. If it goes offline, intents simply wait. No funds are at risk.",
  },
  {
    q: "Can the oracle operator steal my funds?",
    a: "No. The NoxGuardModule re-checks every policy constraint on-chain before executing. Even a fully compromised oracle cannot bypass whitelisted targets, spending caps, or daily limits.",
  },
  {
    q: "What does the TEE actually do?",
    a: "The Trusted Execution Environment (iExec Nox) decrypts your intent handle, verifies the transaction parameters match the encrypted data, checks policy, and produces a cryptographic proof that the on-chain verifier validates.",
  },
  {
    q: "Is this production-ready?",
    a: "This is a hackathon prototype on Sepolia testnet. The architecture is sound, but it hasn't been audited. Don't use it with real funds.",
  },
  {
    q: "Do I need the Chrome extension?",
    a: "No — the full dApp works standalone. The extension adds convenience: a 'Shield with Nox' button injected directly into the Safe app UI so you can encrypt intents without leaving the Safe interface.",
  },
  {
    q: "Which wallets are supported?",
    a: "Any injected wallet that supports Sepolia — MetaMask, Rabby, Coinbase Wallet, etc. Connect through the dApp or the Chrome extension.",
  },
];

export function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-charcoal">
      {/* ── Glass Nav ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6"
        style={{ paddingTop: scrolled ? 8 : 16, transition: "padding 0.35s cubic-bezier(0.83, 0, 0.17, 1)" }}
      >
        <div
          className="max-w-6xl mx-auto flex items-center justify-between px-6"
          style={{
            height: scrolled ? 56 : 64,
            borderRadius: "9999px",
            background: scrolled ? "rgba(23, 30, 25, 0.7)" : "transparent",
            backdropFilter: scrolled ? "blur(16px) saturate(1.8)" : "none",
            WebkitBackdropFilter: scrolled ? "blur(16px) saturate(1.8)" : "none",
            boxShadow: scrolled
              ? "rgba(255, 225, 124, 0.08) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.25) 0px 4px 24px"
              : "none",
            border: scrolled ? "1px solid rgba(255, 225, 124, 0.12)" : "1px solid transparent",
            transition: "all 0.35s cubic-bezier(0.83, 0, 0.17, 1)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center border-2 border-black">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                <path d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z" fill="#000" stroke="#000" strokeWidth="1"/>
                <path d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z" fill="#ffe17c"/>
              </svg>
            </div>
            <span className="font-heading font-bold text-lg text-white tracking-tight">Nox-Safe</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {[
              { href: "#features", label: "Features" },
              { href: "#how-it-works", label: "How it Works" },
              { href: "#security", label: "Security" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-full font-body font-bold text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <Link
            to="/products"
            className="font-heading font-bold text-sm px-5 py-2.5 bg-primary text-black rounded-full border-2 border-black transition-all duration-200 hover:bg-primary/90"
            style={{ boxShadow: "3px 3px 0px 0px #000" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translate(3px, 3px)";
              e.currentTarget.style.boxShadow = "0 0 0 0 #000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(0, 0)";
              e.currentTarget.style.boxShadow = "3px 3px 0px 0px #000";
            }}
          >
            Launch App
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 md:pt-40 pb-20 md:pb-28">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,225,124,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,225,124,1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }} />
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #ffe17c 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #b7c6c2 0%, transparent 70%)" }} />

        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left — Text */}
            <motion.div variants={stagger(0.1)} initial="hidden" animate="show">
              {/* Top iExec Nox Integration Badge */}
              <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3 mb-8">
                <a
                  href="https://docs.noxprotocol.io/getting-started/welcome"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 badge-brutal bg-primary text-black text-xs font-heading font-bold border-2 border-black hover:bg-primary/90 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                  <span>Powered by iExec Nox</span>
                  <span className="opacity-60 text-[10px] uppercase font-mono">TEE Layer</span>
                </a>
                <div className="inline-flex items-center gap-2 badge-brutal bg-charcoal text-primary text-xs border-primary/30">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Sepolia Testnet
                </div>
              </motion.div>

              <motion.h1 variants={fadeUp} className="font-heading font-extrabold text-5xl md:text-6xl lg:text-7xl text-white leading-[1.05] tracking-tight">
                Your transactions.
                <br />
                <span className="text-primary">Nobody's business.</span>
              </motion.h1>

              <motion.p variants={fadeUp} className="font-body text-lg md:text-xl text-sage mt-6 max-w-lg leading-relaxed">
                Nox-Safe encrypts your Safe multisig transactions before they hit the blockchain using iExec Nox TEE handles.
                Nobody sees your moves until they're executed.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-4 mt-10">
                <Link to="/products" className="btn-accent btn-brutal-lg text-lg !px-8 !py-4">
                  Launch App
                </Link>
                <a href="#how-it-works" className="btn-brutal bg-charcoal text-white border-sage/30 text-lg !px-8 !py-4 hover:border-primary/50">
                  How it Works
                </a>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-8 mt-8 pt-6 border-t border-sage/10">
                {STATS.map((s) => (
                  <div key={s.label}>
                    <p className="font-heading font-extrabold text-3xl text-primary">{s.value}</p>
                    <p className="font-body font-bold text-sm text-white mt-1">{s.label}</p>
                    <p className="font-body text-xs text-sage/60">{s.sub}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right — Visual */}
            <motion.div
              className="hidden lg:block relative"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
            >
              <div className="card-brutal bg-white p-6 rotate-1 relative z-10"
                style={{ boxShadow: "8px 8px 0px 0px rgba(255,225,124,0.3)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-heading font-bold text-lg">Intent #0x3f…a1</span>
                  <span className="badge-brutal bg-primary text-black text-xs">Pending</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="font-body text-sm text-gray-500">Target</span>
                    <span className="font-mono text-sm">0xd8dA…6045</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-body text-sm text-gray-500">Value</span>
                    <span className="font-heading font-bold text-xl">0.5 ETH</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-body text-sm text-gray-500">Calldata</span>
                    <span className="font-mono text-sm text-gray-400">0x</span>
                  </div>
                  <div className="h-px bg-gray-200 my-2" />
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-gray-500">Nox Handle</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 border border-black" />
                      <span className="font-mono text-xs text-gray-400">0xf7c2…9e3d</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 w-48 z-20">
                <div className="bg-charcoal border-2 border-primary/30 rounded-xl p-4"
                  style={{ boxShadow: "4px 4px 0px 0px rgba(255,225,124,0.2)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke="#ffe17c" strokeWidth="2.5" />
                      <path d="M7 11V7a5 5 0 0110 0v4" stroke="#ffe17c" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <span className="font-heading font-bold text-xs text-primary">Encrypted</span>
                  </div>
                  <div className="font-mono text-[10px] text-sage/60 leading-relaxed break-all">
                    0xf7c29e3d4a1b8c5f2d6e7a0b3c4d5e6f…
                  </div>
                </div>
              </div>

              <div className="card-brutal bg-sage/10 border-sage/30 p-5 -rotate-2 -mt-6 ml-8 relative z-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-sage rounded-lg border-2 border-black flex items-center justify-center">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                      <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="black" strokeWidth="2.5" />
                      <path d="M9 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-heading font-bold text-sm">TEE Verification</p>
                    <p className="font-body text-xs text-gray-500">iExec Nox Gateway</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {["Policy: Active", "Target: Whitelisted", "Value: Under cap", "Daily limit: OK"].map((check) => (
                    <div key={check} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-400 border border-black flex items-center justify-center">
                        <svg width="8" height="8" fill="none" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" stroke="black" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="font-body text-xs text-gray-600">{check}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-y border-sage/10 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-40">
            {["Safe{Wallet}", "iExec", "Nox TEE", "Sepolia", "Solidity"].map((name) => (
              <span key={name} className="font-heading font-bold text-lg md:text-xl text-white tracking-tight">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-white border-y-2 border-black py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="badge-brutal bg-primary text-black text-xs mx-auto mb-4">Core Features</div>
            <h2 className="font-heading font-extrabold text-4xl md:text-5xl text-black tracking-tight">Why Nox-Safe?</h2>
            <p className="font-body text-lg text-gray-500 mt-4 max-w-2xl mx-auto">
              Traditional Safe transactions are transparent — anyone can see the recipient, amount, and calldata before they execute. Nox-Safe keeps that private.
            </p>
          </div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            variants={stagger(0)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
          >
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="card-brutal card-brutal-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all duration-200">
                <div className={`w-14 h-14 ${f.bg} rounded-xl border-2 border-black flex items-center justify-center mb-5`}>
                  {f.icon}
                </div>
                <h3 className="font-heading font-bold text-xl mb-2">{f.title}</h3>
                <p className="font-body text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Before / After ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="badge-brutal bg-charcoal text-primary text-xs border-primary/30 mx-auto mb-4">The Problem</div>
            <h2 className="font-heading font-extrabold text-4xl md:text-5xl text-white tracking-tight">Before &amp; After</h2>
            <p className="font-body text-lg text-sage mt-4 max-w-2xl mx-auto">Standard Safe multisig vs. Nox-Safe confidential intents</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              className="card-brutal card-brutal-lg bg-white relative overflow-hidden"
              variants={slideLeft}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-400" />
              <div className="flex items-center gap-3 mb-6 mt-2">
                <div className="w-10 h-10 bg-red-100 rounded-xl border-2 border-black flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" stroke="#f87171" strokeWidth="2.5" />
                    <path d="M15 9l-6 6M9 9l6 6" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xl">Standard Multisig</h3>
                  <p className="font-body text-xs text-gray-400">Without Nox-Safe</p>
                </div>
              </div>
              <div className="space-y-4">
                {COMPARE.before.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-100 border border-red-300 flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                        <path d="M18 6L6 18M6 6l12 12" stroke="#f87171" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-body font-bold text-sm text-black">{item.label}</p>
                      <p className="font-body text-sm text-gray-500">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="card-brutal card-brutal-lg bg-white relative overflow-hidden"
              variants={slideRight}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
              <div className="flex items-center gap-3 mb-6 mt-2">
                <div className="w-10 h-10 bg-primary rounded-xl border-2 border-black flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="black" strokeWidth="2.5" />
                    <path d="M9 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xl">With Nox-Safe</h3>
                  <p className="font-body text-xs text-gray-400">Confidential intents</p>
                </div>
              </div>
              <div className="space-y-4">
                {COMPARE.after.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 border border-green-300 flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-body font-bold text-sm text-black">{item.label}</p>
                      <p className="font-body text-sm text-gray-500">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="badge-brutal bg-charcoal text-primary text-xs border-primary/30 mx-auto mb-4">Step by Step</div>
            <h2 className="font-heading font-extrabold text-4xl md:text-5xl text-white tracking-tight">How it works</h2>
            <p className="font-body text-lg text-sage mt-4 max-w-2xl mx-auto">Four steps from encrypted intent to executed transaction</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative">
                <div className="card-brutal card-brutal-lg bg-white">
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 bg-primary rounded-xl border-2 border-black flex items-center justify-center shrink-0">
                      <span className="font-heading font-extrabold text-xl">{s.num}</span>
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-xl mb-2">{s.title}</h3>
                      <p className="font-body text-gray-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute -bottom-3 left-12 w-0.5 h-6 bg-primary" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture Flow ── */}
      <section className="bg-white border-y-2 border-black py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="badge-brutal bg-primary text-black text-xs mx-auto mb-4">Architecture</div>
            <h2 className="font-heading font-extrabold text-4xl md:text-5xl text-black tracking-tight">End-to-end flow</h2>
            <p className="font-body text-lg text-gray-500 mt-4 max-w-2xl mx-auto">
              From encrypted intent to executed transaction — every component in the pipeline
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-stretch gap-0 justify-center">
            {[
              {
                icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="black" strokeWidth="2.5" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="black" strokeWidth="2.5" strokeLinecap="round" /></svg>,
                title: "User", desc: "Fills in target, value, calldata", bg: "bg-white",
              },
              {
                icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" stroke="black" strokeWidth="2.5" /><path d="M7 11V7a5 5 0 0110 0v4" stroke="black" strokeWidth="2.5" strokeLinecap="round" /></svg>,
                title: "Encrypt", desc: "Recipient + value → Nox handle (32 bytes)", bg: "bg-primary",
              },
              {
                icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="18" rx="3" stroke="black" strokeWidth="2.5" /><path d="M8 12h8M8 8h5" stroke="black" strokeWidth="2.5" strokeLinecap="round" /></svg>,
                title: "On-Chain", desc: "submitIntent(safe, handle) → stored", bg: "bg-white",
              },
              {
                icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="black" strokeWidth="2.5" /><path d="M9 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                title: "TEE", desc: "Decrypt → policy check → proof", bg: "bg-sage",
              },
              {
                icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                title: "Execute", desc: "Safe.execTransactionFromModule()", bg: "bg-primary",
              },
            ].map((step, i, arr) => (
              <div key={step.title} className="flex items-center">
                <div className={`card-brutal ${step.bg} p-5 text-center flex-shrink-0`}
                  style={{ width: "180px", boxShadow: "4px 4px 0px 0px #000" }}
                >
                  <div className="w-12 h-12 bg-white rounded-xl border-2 border-black flex items-center justify-center mx-auto mb-3">
                    {step.icon}
                  </div>
                  <h4 className="font-heading font-bold text-sm mb-1">{step.title}</h4>
                  <p className="font-body text-xs text-gray-500 leading-snug">{step.desc}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden md:flex items-center px-1">
                    <svg width="28" height="16" fill="none" viewBox="0 0 28 16">
                      <path d="M0 8h22M18 3l6 5-6 5" stroke="#ffe17c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {i < arr.length - 1 && (
                  <div className="flex md:hidden items-center justify-center py-2">
                    <svg width="16" height="28" fill="none" viewBox="0 0 16 28">
                      <path d="M8 0v22M3 18l5 6 5-6" stroke="#ffe17c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ── */}
      <section id="security" className="border-y-2 border-sage/20 py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="card-brutal card-brutal-lg bg-charcoal border-sage/40 py-16 px-8 md:px-16 relative overflow-hidden">
            <div className="absolute inset-0 dot-pattern opacity-20 pointer-events-none" />
            <div className="relative text-center">
              <div className="badge-brutal bg-primary text-black text-xs mx-auto mb-6">Security Model</div>
              <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-primary tracking-tight mb-4">
                Trust the contract, not the operator
              </h2>
              <p className="font-body text-sage text-lg max-w-2xl mx-auto leading-relaxed mb-10">
                The on-chain NoxGuardModule re-verifies every policy constraint — active status, whitelisted targets, per-transaction caps, daily spending limits — regardless of what the oracle reports. A compromised oracle can delay or censor, but it cannot bypass your policy.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <div className="badge-brutal bg-primary text-black">NoxGuardModule</div>
                <div className="badge-brutal bg-sage text-black">PolicyRegistry</div>
                <div className="badge-brutal bg-white text-black">Proof Verification</div>
                <div className="badge-brutal bg-primary text-black">iExec Nox TEE</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Chrome Extension ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="badge-brutal bg-primary text-black text-xs mb-6">Chrome Extension</div>
              <h2 className="font-heading font-extrabold text-4xl md:text-5xl text-white tracking-tight mb-4">
                Shield directly<br /><span className="text-primary">from Safe</span>
              </h2>
              <p className="font-body text-lg text-sage leading-relaxed mb-8">
                Our Chrome extension injects a "Shield with Nox" button right into the Safe app UI.
                No context switching — encrypt and submit intents without leaving the Safe interface.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  "Auto-detects transaction parameters from the Safe form",
                  "One-click encryption with the Nox handle flow",
                  "Submits directly to NoxGuardModule on Sepolia",
                  "Matches the Safe UI — no tab switching, no copy-pasting",
                ].map((feat) => (
                  <div key={feat} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary border-2 border-black flex items-center justify-center shrink-0">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" stroke="black" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="font-body text-sm text-sage">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative">
                <div className="bg-white border-2 border-black rounded-xl overflow-hidden"
                  style={{ boxShadow: "8px 8px 0px 0px #000" }}
                >
                  <div className="bg-gray-100 border-b-2 border-black px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400 border border-black" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400 border border-black" />
                      <div className="w-3 h-3 rounded-full bg-green-400 border border-black" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-white border-2 border-black rounded-lg px-3 py-1 text-center">
                        <span className="font-mono text-xs text-gray-400">app.safe.global/sep:0x1234...5678</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-black" />
                      <div>
                        <p className="font-heading font-bold text-sm">New Transaction</p>
                        <p className="font-body text-xs text-gray-400">Send assets</p>
                      </div>
                    </div>
                    <div className="space-y-3 mb-4">
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <p className="font-body text-xs text-gray-400 mb-1">Recipient</p>
                        <p className="font-mono text-xs">0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <p className="font-body text-xs text-gray-400 mb-1">Amount</p>
                        <p className="font-heading font-bold text-sm">0.5 ETH</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold opacity-50 border border-green-600">Submit</div>
                      <div className="bg-primary text-black px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-black flex items-center gap-2"
                        style={{ boxShadow: "3px 3px 0px 0px #000", fontFamily: "'Space Grotesk'" }}
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                          <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" strokeWidth="2.5" />
                          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Shield with Nox
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-14 h-14 bg-primary border-2 border-black rounded-2xl flex items-center justify-center"
                  style={{ boxShadow: "4px 4px 0px 0px #000" }}
                >
                  <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                      <path d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z" fill="#ffe17c" stroke="#ffe17c" strokeWidth="1"/>
                      <path d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z" fill="#000"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-white border-y-2 border-black py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="badge-brutal bg-sage text-black text-xs mx-auto mb-4">FAQ</div>
            <h2 className="font-heading font-extrabold text-4xl md:text-5xl text-black tracking-tight">Questions? Answered.</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <details key={i} className="group card-brutal cursor-pointer">
                <summary className="flex items-center justify-between list-none font-heading font-bold text-lg">
                  <span>{faq.q}</span>
                  <div className="w-8 h-8 bg-primary rounded-lg border-2 border-black flex items-center justify-center shrink-0 ml-4 group-open:rotate-45 transition-transform duration-200">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </summary>
                <p className="font-body text-gray-500 leading-relaxed mt-4 pt-4 border-t border-gray-200">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28 relative">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,225,124,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,225,124,1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }} />
        <motion.div
          className="max-w-6xl mx-auto px-6 text-center relative"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <motion.h2 variants={fadeUp} className="font-heading font-extrabold text-4xl md:text-5xl text-white tracking-tight mb-4">Ready to go dark?</motion.h2>
          <motion.p variants={fadeUp} className="font-body text-lg text-sage mb-10 max-w-xl mx-auto">
            Connect your wallet and start submitting confidential intents on Sepolia testnet.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link to="/products" className="btn-accent btn-brutal-lg text-xl !px-10 !py-5">
              Launch Nox-Safe
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="w-full relative overflow-hidden">
        <div className="relative w-full flex justify-center items-end pt-24 md:pt-32 pb-0 bg-charcoal">
          <h2
            className="font-heading font-extrabold text-[100px] sm:text-[140px] md:text-[200px] leading-[0.75] select-none -mb-3 md:-mb-5 text-transparent opacity-40"
            style={{ WebkitTextStroke: "1px rgba(255, 225, 124, 0.4)" }}
          >
            NOX-SAFE
          </h2>
        </div>
        <div className="relative w-full bg-primary border-t-2 border-black min-h-[400px]">
          <div className="absolute inset-0 dot-pattern opacity-[0.08] pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-6 md:px-12 pt-32 md:pt-40 pb-16 md:pb-20 flex flex-col lg:flex-row justify-between gap-16 lg:gap-8">
            <div className="flex flex-col justify-between max-w-sm w-full">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                      <path d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z" fill="#ffe17c" stroke="#ffe17c" strokeWidth="1"/>
                      <path d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z" fill="#000"/>
                    </svg>
                  </div>
                  <span className="font-heading font-extrabold text-xl text-black">Nox-Safe</span>
                </div>
                <p className="font-body text-black/70 text-sm md:text-base leading-relaxed">
                  Confidential transaction guard for Safe multisig. Encrypt intents, enforce policy on-chain, execute via TEE.
                </p>
              </div>
              <div className="flex flex-col gap-3 mt-12 lg:mt-auto pt-8">
                <div className="flex gap-3">
                  {[
                    { label: "GitHub", href: "https://github.com/danielamodu/Nox-safe", d: "M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" },
                    { label: "Twitter", href: "https://x.com/szrxbt", d: "M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" },
                  ].map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-black rounded-lg border-2 border-black flex items-center justify-center hover:bg-black/80 transition-colors" title={s.label}>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                        <path d={s.d} fill="#ffe17c" />
                      </svg>
                    </a>
                  ))}
                </div>
                <p className="font-body text-black/50 text-xs mt-2">© 2026 Nox-Safe. <a href="https://github.com/danielamodu/Nox-safe" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">View on GitHub</a></p>
              </div>
            </div>

            <div className="flex gap-12 md:gap-20 flex-wrap lg:flex-nowrap">
              {[
                {
                  title: "Products",
                  links: [
                    { name: "Choose Product", href: "/products" },
                    { name: "Nox-Safe Dashboard", href: "/app/safe" },
                    { name: "Submit Intent", href: "/app/safe/submit" },
                    { name: "NoxPay — Shield Stream", href: "/app/noxpay" },
                    { name: "NoxPay — Withdraw", href: "/app/noxpay/withdraw" },
                  ],
                },
                {
                  title: "Developers",
                  links: [
                    { name: "Docs", href: "/docs" },
                    { name: "Privacy Policy", href: "/privacy" },
                    { name: "Terms of Service", href: "/terms" },
                    { name: "How it Works", href: "#how-it-works" },
                    { name: "FAQ", href: "#faq" },
                  ],
                },
                {
                  title: "Resources",
                  links: [
                    { name: "iExec Nox Docs", href: "https://docs.noxprotocol.io/getting-started/welcome" },
                    { name: "Safe Documentation", href: "https://docs.safe.global" },
                    { name: "NoxGuardModule on Etherscan", href: "https://sepolia.etherscan.io/address/0x1Ba951E0883e5F4AFEdCdF88B76B8EeF34165a51" },
                    { name: "Sepolia Faucet", href: "https://sepoliafaucet.com" },
                    { name: "GitHub", href: "https://github.com/danielamodu/Nox-safe" },
                  ],
                },
              ].map((section) => (
                <div key={section.title} className="flex flex-col gap-4">
                  <h3 className="font-heading font-bold text-lg text-black">{section.title}</h3>
                  <ul className="flex flex-col gap-3">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        {link.href.startsWith("/") ? (
                          <Link to={link.href} className="font-body text-sm text-black/60 hover:text-black transition-colors">{link.name}</Link>
                        ) : (
                          <a href={link.href} className="font-body text-sm text-black/60 hover:text-black transition-colors">{link.name}</a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
