import { Link } from "react-router-dom";
import { GlassNav } from "../components/GlassNav";

export function Terms() {
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
            Terms of Service
          </h1>
          <p className="font-body text-sm text-white/40 font-mono">Last updated: July 2025</p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Testnet notice */}
        <div className="bg-primary border-2 border-black p-5 mb-12">
          <p className="font-body font-bold text-sm text-black">
            Nox-Safe is a hackathon prototype running on Sepolia testnet. It has not been audited. Do not use it to manage real funds on Ethereum mainnet or any other production network.
          </p>
        </div>

        <div className="space-y-10 font-body text-black/80 leading-relaxed">
          <TermsSection title="1. Acceptance of terms">
            <p>
              By accessing or using the Nox-Safe application (the "App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.
            </p>
          </TermsSection>

          <TermsSection title="2. Nature of the service">
            <p>
              Nox-Safe is an open-source, client-side web application and Chrome extension that facilitates interaction with smart contracts deployed on the Sepolia Ethereum testnet. It was built as a submission for the iExec WTF!! hackathon and is provided for demonstration and educational purposes.
            </p>
            <p className="mt-3">
              The App does not custody your funds, keys, or credentials. All wallet interactions are handled directly by your wallet software (e.g., MetaMask). We have no ability to initiate transactions on your behalf.
            </p>
          </TermsSection>

          <TermsSection title="3. Testnet only — no real value">
            <p>
              All contracts are deployed on Sepolia testnet. Sepolia ETH has no monetary value. Do not attempt to bridge or transfer real ETH into the contracts.
            </p>
            <p className="mt-3">
              We make no representation that this software is suitable for use with real funds on any production network. No audit has been performed.
            </p>
          </TermsSection>

          <TermsSection title="4. No warranties">
            <p>The App is provided "as is" and "as available" without warranty of any kind. We do not warrant that:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-sm text-black/70">
              <li>The App will be available at any particular time or uninterrupted</li>
              <li>The smart contracts are free from bugs or vulnerabilities</li>
              <li>The oracle daemon (nox-task) will process your intent within any specific timeframe</li>
              <li>The iExec Nox testnet gateway will remain available or behave consistently</li>
            </ul>
          </TermsSection>

          <TermsSection title="5. Limitation of liability">
            <p>
              To the maximum extent permitted by applicable law, the creators of Nox-Safe shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of funds, data, or profits, arising out of or related to your use of the App.
            </p>
          </TermsSection>

          <TermsSection title="6. User responsibilities">
            <p>You are solely responsible for:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-sm text-black/70">
              <li>Safeguarding your wallet private keys and seed phrase</li>
              <li>Verifying the contract addresses you interact with</li>
              <li>Understanding that multisig transactions require approval from co-signers</li>
              <li>Ensuring the oracle daemon is running if you need intents fulfilled</li>
              <li>Complying with applicable laws in your jurisdiction</li>
            </ul>
          </TermsSection>

          <TermsSection title="7. Intellectual property">
            <p>
              Nox-Safe is released under the MIT License. You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the terms of that license.
            </p>
          </TermsSection>

          <TermsSection title="8. Third-party services">
            <p>
              The App integrates with iExec Nox, Safe Transaction Service, and the Sepolia network. Your use of those services is governed by their respective terms and policies. We are not responsible for the availability or conduct of any third-party service.
            </p>
          </TermsSection>

          <TermsSection title="9. Governing law">
            <p>
              These Terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved through good-faith discussion before any formal proceeding.
            </p>
          </TermsSection>

          <TermsSection title="10. Changes to these terms">
            <p>
              We may revise these Terms at any time by updating this page. Continued use of the App after changes constitutes acceptance.
            </p>
          </TermsSection>

          <TermsSection title="11. Contact">
            <p>
              Questions about these Terms can be directed via{" "}
              <a href="https://github.com/danielamodu" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                GitHub (@danielamodu)
              </a>{" "}
              or{" "}
              <a href="https://x.com/szrxbt" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                Twitter (@szrxbt)
              </a>.
            </p>
          </TermsSection>
        </div>

        {/* Footer nav */}
        <div className="mt-20 pt-8 border-t-2 border-black flex flex-wrap gap-6">
          <Link to="/" className="font-body text-sm text-black/60 hover:text-black transition-colors">← Back to home</Link>
          <Link to="/docs" className="font-body text-sm text-black/60 hover:text-black transition-colors">Docs</Link>
          <Link to="/privacy" className="font-body text-sm text-black/60 hover:text-black transition-colors">Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading font-extrabold text-xl text-black mb-4 pb-2 border-b-2 border-black">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
