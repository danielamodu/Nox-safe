import { Link } from "react-router-dom";
import { GlassNav } from "../components/GlassNav";

export function Privacy() {
  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <GlassNav />

      {/* Dark hero strip */}
      <div className="bg-charcoal pt-32 pb-16 px-6 border-b-2 border-black">
        <div className="max-w-4xl mx-auto">
          <div className="inline-block bg-primary border-2 border-black px-3 py-1 font-mono text-xs font-bold mb-6">
            LEGAL
          </div>
          <h1 className="font-heading font-extrabold text-5xl md:text-6xl text-white tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="font-body text-sm text-white/40 font-mono">Last updated: July 2026</p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="space-y-10 font-body text-black/80 leading-relaxed">
          <PolicySection title="1. What we collect">
            <p>
              Nox-Safe is a client-side application. We do not operate a backend, user database, or authentication service. No account is created when you use the app.
            </p>
            <p className="mt-3">The only data transmitted to external services is:</p>
            <ul className="mt-3 space-y-2 list-none">
              {[
                ["Encrypted intent data", "Your recipient address and ETH value are sent to the iExec Nox gateway (gateway-testnets.noxprotocol.dev) to produce encrypted handles. The Nox TEE processes this inside a confidential enclave — the plaintext is not stored by the gateway."],
                ["On-chain transactions", "When you submit an intent or configure a policy, a transaction is broadcast to the Sepolia Ethereum testnet through your connected wallet (MetaMask or equivalent). This data is public on the blockchain."],
                ["Wallet address", "Your connected wallet address is read locally by the app to determine your Safe and its configuration. It is not sent to any Nox-Safe server."],
              ].map(([label, desc]) => (
                <li key={label as string} className="border-2 border-black bg-white p-4">
                  <span className="font-mono font-bold text-xs block mb-1 text-black">{label}</span>
                  <span className="text-sm text-black/70">{desc}</span>
                </li>
              ))}
            </ul>
          </PolicySection>

          <PolicySection title="2. Cookies and tracking">
            <p>
              We do not use cookies, analytics scripts, tracking pixels, or any third-party advertising technology. There is no telemetry collected by the Nox-Safe application.
            </p>
          </PolicySection>

          <PolicySection title="3. Third-party services">
            <p>Nox-Safe interacts with the following third-party services during normal operation:</p>
            <ul className="mt-4 space-y-3">
              {[
                ["iExec Nox gateway", "Handles encryption of intent data. Subject to iExec's privacy policy. Requests are made only when you initiate an intent submission."],
                ["Safe Transaction Service", "Used to propose and collect multisig signatures for module enable / policy set transactions. Public API, no authentication required."],
                ["Sepolia Ethereum network", "All on-chain interactions are public by design. Transaction data, wallet addresses, and encrypted handles are visible on-chain."],
                ["Etherscan (optional)", "Contract verification links open Etherscan in a new tab. Etherscan's own privacy policy applies."],
              ].map(([name, desc]) => (
                <li key={name as string} className="flex gap-3">
                  <span className="font-mono font-bold text-sm text-black shrink-0 w-48">{name}</span>
                  <span className="text-sm text-black/70">{desc}</span>
                </li>
              ))}
            </ul>
          </PolicySection>

          <PolicySection title="4. Blockchain data">
            <p>
              Transactions broadcast to the Sepolia testnet are permanently public and immutable. Encrypted handles stored on-chain are opaque 32-byte values — the plaintext is not recoverable without access to the iExec Nox TEE decryption infrastructure.
            </p>
            <p className="mt-3">We have no ability to delete or alter on-chain data on your behalf.</p>
          </PolicySection>

          <PolicySection title="5. Children">
            <p>Nox-Safe is not directed at children under 18. We do not knowingly collect information from children.</p>
          </PolicySection>

          <PolicySection title="6. Changes to this policy">
            <p>
              We may update this policy as the product evolves. Material changes will be reflected in the "Last updated" date above. Continued use of the app after a policy update constitutes acceptance of the revised terms.
            </p>
          </PolicySection>

          <PolicySection title="7. Contact">
            <p>
              For privacy questions, open an issue on{" "}
              <a href="https://github.com/danielamodu/Nox-safe" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                GitHub
              </a>{" "}
              or reach out on{" "}
              <a href="https://x.com/szrxbt" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                Twitter (@szrxbt)
              </a>.
            </p>
          </PolicySection>
        </div>

        {/* Footer nav */}
        <div className="mt-20 pt-8 border-t-2 border-black flex flex-wrap gap-6">
          <Link to="/about" className="font-body text-sm text-black/60 hover:text-black transition-colors">← Back to home</Link>
          <Link to="/docs" className="font-body text-sm text-black/60 hover:text-black transition-colors">Docs</Link>
          <Link to="/terms" className="font-body text-sm text-black/60 hover:text-black transition-colors">Terms of Service</Link>
        </div>
      </main>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading font-extrabold text-xl text-black mb-4 pb-2 border-b-2 border-black">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
