import { Link } from "react-router-dom";

export function Docs() {
  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Nav */}
      <nav className="border-b-2 border-black bg-[#f5f0e8] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="font-heading font-extrabold text-xl text-black tracking-tight">
            Nox-Safe
          </Link>
          <Link
            to="/app"
            className="font-body font-bold text-sm bg-primary text-black px-4 py-2 border-2 border-black"
            style={{ boxShadow: "2px 2px 0px #000" }}
          >
            Launch App →
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-14">
          <div className="inline-block bg-primary border-2 border-black px-3 py-1 font-mono text-xs font-bold mb-6">
            DOCUMENTATION
          </div>
          <h1 className="font-heading font-extrabold text-5xl md:text-6xl text-black tracking-tight mb-4">
            How Nox-Safe works
          </h1>
          <p className="font-body text-lg text-black/60 max-w-2xl">
            Technical reference for the contracts, oracle daemon, and Chrome extension. Built for the iExec WTF!! hackathon on Sepolia.
          </p>
        </div>

        <div className="space-y-12">
          {/* Architecture */}
          <Section title="Architecture overview">
            <p>
              Nox-Safe wraps two existing protocols — <strong>Safe</strong> (multisig treasury) and <strong>Sablier</strong> (token streaming) — with confidentiality via the iExec Nox TEE. Nothing is forked. The recipient address and ETH value of every Safe transaction are encrypted client-side and stored on-chain only as opaque 32-byte handles. An off-chain oracle decrypts them inside the TEE, validates them against a per-Safe policy, and executes through Safe's standard module interface.
            </p>
            <CodeBlock>{`Client
  └─ encrypt(target, value) via Nox gateway
  └─ submitIntent(safe, targetHandle, valueHandle, …)
        ↓ IntentSubmitted event
nox-task (oracle)
  └─ fetch decryption proofs from Nox gateway
  └─ validate against PolicyRegistry
  └─ fulfillIntent(target, value, proofs)
        ↓
NoxGuardModule (on-chain)
  └─ Nox.publicDecrypt — verify proof on-chain
  └─ re-check PolicyRegistry
  └─ Safe.execTransactionFromModule → funds move`}</CodeBlock>
          </Section>

          {/* Deployed contracts */}
          <Section title="Deployed contracts — Sepolia">
            <p>All contracts are verified on Sepolia. No contracts need to be deployed to use the app.</p>
            <table className="w-full border-2 border-black mt-4 text-sm font-mono">
              <thead>
                <tr className="bg-black text-white">
                  <th className="text-left px-4 py-2">Contract</th>
                  <th className="text-left px-4 py-2">Address</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["PolicyRegistry", "0x1A86ed6a9739Ae24D089FaC892DeC2f09280Cce1"],
                  ["NoxGuardModule", "0xbb616000b55d256cEC4fb9E211f4138e43cbA2e5"],
                  ["NoxRecipientProxy", "0x1D9f855d88e526745fDb8b04Fe3180a274604172"],
                  ["SablierV2LockupLinear", "0xAFb979d9afAd1aD27C5eFf4E27226E3AB9e5dCC9"],
                  ["NoxCompute (iExec)", "0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF"],
                ].map(([name, addr], i) => (
                  <tr key={name} className={i % 2 === 0 ? "bg-white" : "bg-[#f5f0e8]"}>
                    <td className="px-4 py-2 border-t border-black font-bold">{name}</td>
                    <td className="px-4 py-2 border-t border-black">
                      <a
                        href={`https://sepolia.etherscan.io/address/${addr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-primary break-all"
                      >
                        {addr}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* NoxGuardModule */}
          <Section title="NoxGuardModule">
            <p>
              A Safe Module. Once enabled on a Safe, it accepts encrypted intents and executes them after oracle validation.
            </p>
            <ul className="space-y-3 mt-4">
              <DocItem title="submitIntent(safe, targetHandle, targetProof, valueHandle, valueProof, data)">
                Registers both Nox handles on-chain via <code>Nox.fromExternal()</code>, allows public decryption, commits <code>keccak256(data)</code> to prevent calldata substitution, and emits <code>IntentSubmitted</code>.
              </DocItem>
              <DocItem title="fulfillIntent(intentId, target, value, data, targetProof, valueProof)">
                Oracle-only. Calls <code>Nox.publicDecrypt()</code> to verify the gateway proof on-chain, re-checks PolicyRegistry (whitelist, per-tx cap, daily cap), tracks daily spend, then calls <code>Safe.execTransactionFromModule</code>.
              </DocItem>
              <DocItem title="rejectIntent(intentId, reason)">
                Oracle-only. Marks the intent rejected with a human-readable reason string.
              </DocItem>
            </ul>
          </Section>

          {/* PolicyRegistry */}
          <Section title="PolicyRegistry">
            <p>
              Stores per-Safe spend policies. <strong>Only the Safe itself</strong> can call <code>setPolicy</code> — this requires a full multisig transaction signed by the owners. Single signers cannot change a policy unilaterally.
            </p>
            <ul className="space-y-3 mt-4">
              <DocItem title="setPolicy(policy)">
                Sets whitelisted target addresses, max ETH per transaction, and max ETH per UTC day for the calling Safe.
              </DocItem>
              <DocItem title="getPolicy(safe)">
                Returns the current policy struct for a Safe address.
              </DocItem>
              <DocItem title="isTargetWhitelisted(safe, target)">
                View helper — returns true if <code>target</code> is in the Safe's whitelist.
              </DocItem>
            </ul>
          </Section>

          {/* NoxRecipientProxy */}
          <Section title="NoxRecipientProxy — Sablier integration">
            <p>
              A shielded recipient wrapper for Sablier V2 Lockup streams. Deploy a Sablier stream with <code>NoxRecipientProxy</code> as the recipient, then register an encrypted end-recipient. The oracle decrypts and withdraws to the real address.
            </p>
            <ul className="space-y-3 mt-4">
              <DocItem title="registerShieldedStream(sablier, streamId, recipientHandle, recipientProof)">
                Registers an encrypted recipient for a stream. Only the original stream sender can call this.
              </DocItem>
              <DocItem title="requestShieldedWithdraw(sablier, streamId)">
                Emits <code>ShieldedWithdrawRequested</code> to trigger the oracle.
              </DocItem>
              <DocItem title="fulfillShieldedWithdraw(requestId, recipient, recipientProof)">
                Oracle-only. Verifies the Nox proof on-chain, then calls <code>sablier.withdrawMax(streamId, realRecipient)</code>.
              </DocItem>
            </ul>
          </Section>

          {/* Oracle */}
          <Section title="nox-task (oracle daemon)">
            <p>
              A Node.js process (ethers v6) that polls for <code>IntentSubmitted</code> and <code>ShieldedWithdrawRequested</code> events. On startup it scans the last 100 blocks to recover intents missed while offline.
            </p>
            <CodeBlock>{`# .env required vars
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ORACLE_PRIVATE_KEY=<oracle wallet private key, no 0x prefix>
NOX_GUARD_MODULE=0xbb616000b55d256cEC4fb9E211f4138e43cbA2e5
POLICY_REGISTRY=0x1A86ed6a9739Ae24D089FaC892DeC2f09280Cce1
NOX_RECIPIENT_PROXY=0x1D9f855d88e526745fDb8b04Fe3180a274604172`}</CodeBlock>
            <p className="mt-4">
              The oracle wallet must match the <code>noxOracle</code> address stored in <code>NoxGuardModule</code>. To change it, call <code>NoxGuardModule.setNoxOracle(newAddress)</code> from the deployer/owner wallet. For production, run the daemon with PM2 on EC2 for automatic restarts and reboot persistence.
            </p>
          </Section>

          {/* Chrome extension */}
          <Section title="Chrome Extension">
            <p>
              Manifest V3 content script injected into <code>app.safe.global</code>. The floating "Shield with Nox" button only appears when a real Safe is selected (URL contains <code>?safe=&lt;network&gt;:0x…</code>). SPA navigation is intercepted via <code>history.pushState</code> — the button mounts and unmounts correctly as you navigate between pages.
            </p>
            <p className="mt-3">
              The modal reads the target address and value from Safe's own form fields, calls the Nox gateway to produce encrypted handles, and submits to <code>NoxGuardModule.submitIntent</code> through MetaMask.
            </p>
            <p className="mt-3 font-mono text-sm bg-black/5 border border-black/20 px-4 py-3">
              Load unpacked from <code>extension/</code> in Chrome's developer mode — no build step required.
            </p>
          </Section>

          {/* v1 scope */}
          <Section title="v1 scope — what is and isn't private">
            <ul className="space-y-2">
              {[
                ["Encrypted (opaque on-chain)", "Recipient/target address, ETH value in wei, Sablier stream end-recipient"],
                ["Cleartext (integrity-checked only)", "Transaction calldata — its keccak256 is committed at submission, but the calldata itself is visible in the IntentSubmitted event"],
              ].map(([label, desc]) => (
                <li key={label} className="border-2 border-black bg-white p-4">
                  <span className="font-mono font-bold text-xs block mb-1">{label}</span>
                  <span className="font-body text-sm text-black/70">{desc}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-black/60">
              For native ETH transfers (<code>data = 0x</code>) the recipient and amount are fully private until fulfillment. Full calldata privacy (encrypting arbitrary-length bytes) requires a v2 Nox handle type.
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-20 pt-8 border-t-2 border-black flex flex-wrap gap-6">
          <Link to="/" className="font-body text-sm text-black/60 hover:text-black transition-colors">← Back to home</Link>
          <Link to="/privacy" className="font-body text-sm text-black/60 hover:text-black transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="font-body text-sm text-black/60 hover:text-black transition-colors">Terms of Service</Link>
          <Link to="/app" className="font-body text-sm text-black/60 hover:text-black transition-colors">Launch App</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading font-extrabold text-2xl text-black mb-4 pb-2 border-b-2 border-black">
        {title}
      </h2>
      <div className="font-body text-black/80 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

function DocItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="border-l-4 border-primary pl-4">
      <code className="font-mono text-sm font-bold text-black block mb-1">{title}</code>
      <span className="font-body text-sm text-black/70">{children}</span>
    </li>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-4 bg-black text-green-400 font-mono text-xs p-4 overflow-x-auto border-2 border-black leading-relaxed">
      {children}
    </pre>
  );
}
