# Nox-Safe

Nox-Safe adds iExec Nox as a confidentiality layer into two existing, unmodified protocols — **Safe** (multisig treasury) and **Sablier** (token streaming) — without forking either one. It is not a standalone wallet or new chain primitive. The recipient address and ETH value of every Safe transaction are encrypted client-side via the Nox TEE gateway and travel on-chain only as opaque 32-byte handles. A Nox oracle daemon decrypts them inside the TEE, validates them against a per-Safe policy, and executes the transaction through Safe's standard module interface. The Sablier integration works the same way: a stream creator registers an encrypted end-recipient through `NoxRecipientProxy`, and no one on-chain can read the destination until the oracle fulfills a withdrawal.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Client (Web App or Chrome Extension)                    │
│                                                          │
│  1. Encrypt target address + ETH value via Nox gateway   │
│     → two bytes32 handles + input proofs                 │
│  2. submitIntent(safe, targetHandle, targetProof,        │
│                  valueHandle, valueProof, data)          │
└──────────────────────┬───────────────────────────────────┘
                       │  IntentSubmitted event
                       ▼
┌──────────────────────────────────────────────────────────┐
│  nox-task (off-chain oracle daemon)                      │
│                                                          │
│  3. Poll for IntentSubmitted / ShieldedWithdrawRequested │
│  4. Fetch decryption proofs from Nox gateway             │
│  5. Decode plaintext target + value                      │
│  6. Validate off-chain against PolicyRegistry            │
│  7. Call fulfillIntent / fulfillShieldedWithdraw         │
└──────────────────────┬───────────────────────────────────┘
                       │  oracle transaction
                       ▼
┌──────────────────────────────────────────────────────────┐
│  NoxGuardModule (on-chain)                               │
│                                                          │
│  8. Nox.publicDecrypt — verify gateway proof on-chain    │
│  9. Re-check PolicyRegistry (whitelist, per-tx/day caps) │
│  10. Safe.execTransactionFromModule → funds move         │
└──────────────────────────────────────────────────────────┘
```

### NoxGuardModule — Safe integration

A Safe Module. When enabled on a Safe, it accepts encrypted intents and executes them after oracle validation.

- **`submitIntent`** — calls `Nox.fromExternal()` to register each handle on-chain, then `Nox.allowPublicDecryption()` to make them decryptable by the gateway. Stores `keccak256(data)` so the oracle cannot substitute calldata. Emits `IntentSubmitted`.
- **`fulfillIntent`** (oracle only) — calls `Nox.publicDecrypt()` to verify the gateway's decryption proof on-chain, re-checks `PolicyRegistry` (policy may have changed since submission), tracks daily spend, and executes via `Safe.execTransactionFromModule`.
- **`rejectIntent`** (oracle only) — marks the intent rejected with a human-readable reason.

### PolicyRegistry

Stores per-Safe spend policies: an array of whitelisted target addresses, a max ETH value per transaction, and a max ETH value per UTC day. **Only the Safe itself can call `setPolicy`** — this requires a multisig transaction signed by the Safe owners. Policies cannot be changed by any single signer.

### NoxRecipientProxy — Sablier integration

A shielded recipient wrapper for Sablier V2 Lockup streams.

- Stream creator creates a Sablier stream with `NoxRecipientProxy` as the Sablier recipient (NFT holder).
- Stream creator calls `registerShieldedStream`, passing an encrypted end-recipient handle. Only the actual stream sender can call this; the proxy must already be the Sablier recipient.
- Anyone calls `requestShieldedWithdraw` when funds are vested and withdrawable.
- The oracle calls `fulfillShieldedWithdraw`, which verifies the Nox proof on-chain and calls `sablier.withdrawMax(streamId, realRecipient)` directly.

### nox-task oracle daemon

A Node.js polling process (ethers v6) that listens for `IntentSubmitted` and `ShieldedWithdrawRequested` events. For each event it fetches the raw decryption proof from `https://gateway-testnets.noxprotocol.dev`, decodes the plaintext via the trailing 32 bytes of the proof, validates off-chain, then submits the fulfill transaction. On startup it scans the last 100 blocks to catch any intents that arrived while it was offline.

### Chrome Extension

A Manifest V3 content script that injects into `app.safe.global`. On pages where a real Safe is selected (`?safe=<network>:0x...` in the URL), it adds a floating "Shield with Nox" button and an inline button next to Safe's execute/sign controls. The modal auto-detects the target address and value from Safe's form fields, encrypts them via the Nox gateway, and submits to `NoxGuardModule` through MetaMask.

---

## Deployed Contracts — Sepolia

| Contract | Address | Etherscan |
|---|---|---|
| `PolicyRegistry` | `0x1A86ed6a9739Ae24D089FaC892DeC2f09280Cce1` | [view](https://sepolia.etherscan.io/address/0x1A86ed6a9739Ae24D089FaC892DeC2f09280Cce1) |
| `NoxGuardModule` | `0xbb616000b55d256cEC4fb9E211f4138e43cbA2e5` | [view](https://sepolia.etherscan.io/address/0xbb616000b55d256cEC4fb9E211f4138e43cbA2e5) |
| `NoxRecipientProxy` | `0x1D9f855d88e526745fDb8b04Fe3180a274604172` | [view](https://sepolia.etherscan.io/address/0x1D9f855d88e526745fDb8b04Fe3180a274604172) |
| `SablierV2LockupLinear` (Sepolia, Sablier-deployed) | `0xAFb979d9afAd1aD27C5eFf4E27226E3AB9e5dCC9` | [view](https://sepolia.etherscan.io/address/0xAFb979d9afAd1aD27C5eFf4E27226E3AB9e5dCC9) |
| `NoxCompute` (iExec, used by Nox SDK) | `0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF` | [view](https://sepolia.etherscan.io/address/0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF) |

> `MockSafe` and `MockSablierLockup` are test helpers; their addresses are in `contracts/deployments/sepolia.json`. On-chain proof verification is handled by `Nox.publicDecrypt()` in the iExec Nox SDK, which calls `NoxCompute` — there is no separately deployed NoxVerifier contract.

---

## v1 Scope — What Is and Isn't Private

**Encrypted via real Nox handles (opaque on-chain):**
- Recipient/target address (stored as `uint160` packed into `uint256`)
- ETH value in wei
- Sablier stream end-recipient address

**Cleartext, integrity-checked only:**
- Transaction `data` (calldata). Its `keccak256` is committed at submission so the oracle cannot substitute different calldata, but the calldata itself is visible in the `IntentSubmitted` event and in the oracle's `fulfillIntent` call.

**Practical implication:** For native ETH transfers (`data = 0x`) the recipient and amount are fully private until fulfillment. For ERC-20 transfers or DeFi calls where the recipient is encoded in the calldata, that recipient is visible on-chain. Full calldata privacy is a v2 scope item — encrypting arbitrary-length bytes requires a different Nox handle type than `euint256`.

---

## Repository Structure

```
Nox-safe/
├── contracts/              Hardhat project — Solidity + tests + deploy
│   ├── contracts/
│   │   ├── NoxGuardModule.sol
│   │   ├── NoxRecipientProxy.sol
│   │   ├── PolicyRegistry.sol
│   │   └── interfaces/
│   ├── scripts/deploy.ts
│   ├── test/
│   └── deployments/sepolia.json   ← canonical deployed addresses
├── frontend/               React + Vite + wagmi web app
│   └── src/
│       ├── pages/          Dashboard, SubmitIntent, SablierShield, …
│       ├── hooks/          useSafeSetup.ts (Safe Protocol Kit + API Kit)
│       └── config/         contracts.ts (ABIs + addresses)
├── nox-task/               Oracle daemon (Node.js + ethers v6)
│   └── src/index.ts        Main polling loop
├── extension/              Chrome Manifest V3 extension (no build step)
│   ├── manifest.json
│   ├── content/content.js
│   └── popup/
└── feedback.md             Developer experience notes for the iExec team
```

---

## Setup

### Prerequisites

- Node.js ≥ 18
- A funded Sepolia wallet (deployer and oracle can be the same for testing, but should be separate in production)
- A **reliable Sepolia RPC provider** — Infura, Alchemy, or QuickNode. Public endpoints are rate-limited; using one for the oracle daemon caused missed events during development.

---

### 1. Contracts

```bash
cd contracts
npm install
cp .env.example .env
```

Fill in `.env`:

```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
DEPLOYER_PRIVATE_KEY=<deployer private key, no 0x prefix>
ETHERSCAN_API_KEY=<optional, for Etherscan verification>
```

**Deploy to Sepolia:**

```bash
npx hardhat run scripts/deploy.ts --network sepolia
# writes deployments/sepolia.json
```

**Run tests:**

```bash
npx hardhat test
```

After deployment, copy the new addresses from `deployments/sepolia.json` into `frontend/src/config/contracts.ts` and the oracle `.env`.

---

### 2. Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

Contract addresses and ABIs are hardcoded in `src/config/contracts.ts` — no `.env` file needed.

---

### 3. nox-task (Oracle Daemon)

```bash
cd nox-task
npm install
cp .env.example .env
```

Fill in `.env`:

```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ORACLE_PRIVATE_KEY=<oracle wallet private key, no 0x prefix>
NOX_GUARD_MODULE=0xbb616000b55d256cEC4fb9E211f4138e43cbA2e5
POLICY_REGISTRY=0x1A86ed6a9739Ae24D089FaC892DeC2f09280Cce1
NOX_RECIPIENT_PROXY=0x1D9f855d88e526745fDb8b04Fe3180a274604172
```

The oracle wallet address must match the `noxOracle` value stored in `NoxGuardModule`. The initial oracle is set to the deployer address at deploy time. To change it: call `NoxGuardModule.setNoxOracle(newOracleAddress)` from the owner wallet.

**Start:**

```bash
npm start
```

The daemon scans the last 100 blocks on startup, then polls every 12 seconds. All steps are logged with `[nox-task]` prefix.

---

### 4. Chrome Extension

No build step required.

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. **Load unpacked** → select the `extension/` folder
4. Go to `https://app.safe.global` and open an existing Safe

The floating "Shield with Nox" button appears only on transactional pages where a Safe is selected. It does not appear on account creation, settings, or any page without a `?safe=...` query parameter.

---

## Usage Walkthrough

### Safe Flow

**Step 1 — Enable the module on your Safe**

`NoxGuardModule` must be enabled as a Safe module via a multisig transaction:

1. Connect your wallet and enter your Safe address in the web app
2. Click **Enable Module** — this proposes a Safe transaction with calldata:
   ```
   0x610b5925000000000000000000000000bb616000b55d256cec4fb9e211f4138e43cba2e5
   ```
3. Each required owner signs (the app auto-detects pending txs when owners switch wallets, so Owner 2 sees the PendingCard without any manual sharing)
4. Once the threshold is met, execute — the module is active on your Safe

**Step 2 — Set a policy**

Policy changes require a Safe multisig transaction (only the Safe itself can call `setPolicy`):

1. Go to **Set Policy** in the web app
2. Enter whitelisted target addresses (one per line), max ETH per transaction, max ETH per day
3. Propose the transaction, collect signatures from other owners, execute
4. Policy is now live in `PolicyRegistry`

**Step 3 — Submit an encrypted intent**

From the web app or the Chrome extension on `app.safe.global`:

1. Enter the target address, ETH value, and optional calldata
2. Click **Encrypt & Submit**
3. The app calls the Nox gateway twice (target, then value) to get encrypted handles and proofs, then calls `submitIntent` through MetaMask
4. To verify the real Nox encryption fired: open Chrome DevTools → Network, filter by `noxprotocol.dev` — you should see two POST requests to `/v0/secrets`, each returning a `handle` field

**Step 4 — Oracle fulfills**

With `nox-task` running, the daemon picks up `IntentSubmitted` within ~12 seconds, fetches gateway proofs, validates, and calls `fulfillIntent`. The Safe executes the transfer. Intent status flips from Pending to Executed.

---

### Sablier Shielded Recipient Flow

**Step 1 — Create a Sablier stream with the proxy as recipient**

Create a stream on the Sablier UI or directly on-chain, setting the recipient to `NoxRecipientProxy` (`0x1D9f855d88e526745fDb8b04Fe3180a274604172`).

**Step 2 — Register the encrypted real recipient**

In the web app, go to **Sablier Shield**:

1. Enter the Sablier lockup contract address and your stream ID
2. Enter the real end-recipient address — it is encrypted via the Nox gateway before leaving the browser
3. Click **Register Shielded Stream** — calls `NoxRecipientProxy.registerShieldedStream`

**Step 3 — Request a withdrawal**

When vested funds are withdrawable, click **Request Shielded Withdraw**. This calls `requestShieldedWithdraw` and emits `ShieldedWithdrawRequested`.

**Step 4 — Oracle fulfills**

The daemon picks up the event, decrypts the recipient inside the TEE, verifies the Nox proof on-chain, and calls `withdrawMax` on Sablier directly to the real recipient. The on-chain recipient field resolves only at fulfillment.

---

## Known Limitations

**Calldata privacy gap (v1).** Transaction calldata (`data`) is cleartext. Its `keccak256` hash is committed at intent submission so the oracle cannot swap it out, but the calldata itself is visible in the `IntentSubmitted` event. For native ETH transfers (`data = 0x`) there is nothing to leak. For ERC-20 transfers or DeFi calls where the recipient address is encoded in the calldata, that recipient is readable. Encrypting arbitrary-length calldata requires a `euint8[]` or `eBytes` Nox type — a v2 item.

**Oracle liveness dependency.** Submitted intents remain in `Pending` state indefinitely if the oracle is offline. There is no on-chain timeout, no fallback executor, and no permissionless cancellation path for the submitter. In production this needs a heartbeat timeout and fallback mechanism.

**Block timestamp for daily cap reset.** The daily spend cap resets per `block.timestamp / 86400`. Validators can shift `block.timestamp` by a small amount, making the midnight reset boundary approximate. Not a material issue at the value ranges used in v1.

**Policy updates require a full Safe multisig tx.** There is no delegated admin role. Updating the whitelist or caps requires assembling, signing, and executing a new Safe transaction with owner quorum. This is intentional for security but creates friction for teams that adjust policy frequently.

**No on-chain intent index.** The intent history page looks up intents by ID. There is no on-chain index of all intents for a given Safe address. A subgraph or off-chain event indexer would be needed for a full audit trail.

---

## Feedback

See [feedback.md](./feedback.md) for running notes on the iExec Nox developer experience during this build — submitted as part of the hackathon deliverable.

---

## License

MIT
