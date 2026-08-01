# Nox-Safe

**Privacy infrastructure for on-chain finance, powered by iExec Nox TEE.**

Nox-Safe adds a confidential execution layer to two battle-tested DeFi protocols — Safe ($100B+ TVL) and Sablier — without forking or modifying either. Transaction details are encrypted client-side via the Nox TEE gateway, travel on-chain as opaque 32-byte handles, and are decrypted inside a hardware-isolated enclave. Neither the oracle operator nor any on-chain observer can read what is being sent until the moment of execution.

**Nox-Safe** — Confidential treasury execution for Safe multisig. Hide transaction target and value until the moment of execution. Built for DAOs, funds, and companies who can't afford to leak trading intent on-chain. Recipient address and ETH value are encrypted client-side and travel on-chain only as opaque 32-byte handles. A Nox oracle daemon decrypts them inside the TEE, validates against a per-Safe spend policy, and executes through Safe's standard module interface.

**NoxPay** — Confidential payroll streaming on Sablier. Shield employee wallet addresses from public view. Built for companies paying contributors on-chain without exposing who earns what. A stream creator registers an encrypted end-recipient through `NoxRecipientProxy`; no one on-chain can read the destination until the oracle fulfills a withdrawal.

---

## Live Demo

Both products are deployed on Sepolia and running end-to-end. No mock data, no simulated oracles.

### NoxPay — 5 minutes (no Safe setup required)

You need a Sepolia wallet and ERC-20 test tokens.

**Get test USDC**

Use Sepolia USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (Circle's official Sepolia deployment).
Faucet: [faucet.circle.com](https://faucet.circle.com) — select "Ethereum Sepolia", paste your wallet, receive 10 USDC. Takes ~30 seconds.

**Create a shielded stream (Company role)**

1. Go to [noxsafe.website/app/noxpay/company](https://noxsafe.website/app/noxpay/company) and connect a Sepolia wallet
2. Fill in: recipient wallet (a second address you control), token `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`, amount `10`, duration `1` day
3. Click **Create Shielded Stream** — one MetaMask session handles token approval, Sablier stream creation, Nox TEE encryption, and proxy registration
4. Copy the stream ID shown on the success screen

**Watch the oracle fulfill (Employee role)**

1. Go to [noxsafe.website/app/noxpay/employee](https://noxsafe.website/app/noxpay/employee)
2. Paste the stream ID — vested amount and withdrawable balance are shown live
3. Click **Request Shielded Withdrawal** — oracle picks it up within ~30 seconds and calls `withdrawMax` directly to the decrypted recipient wallet
4. Confirm on [NoxRecipientProxy events](https://sepolia.etherscan.io/address/0xc8E18A3F8386D00A7095A49eABa0F1265f7dc3F0#events) — look for `ShieldedWithdrawExecuted`

**Verified on-chain fulfillments:**
- [`ShieldedWithdrawExecuted` — 0x879a2a6…](https://sepolia.etherscan.io/tx/0x879a2a653abafb979402e657908ebd059c97c5f8c151b584e5e19daf545587da)
- [`IntentExecuted` — 0x06345fa…](https://sepolia.etherscan.io/tx/0x06345fabe651700a57586ff6da6ea49b82130f8996bc1953ad20f4716744f9c7)

---

### Nox-Safe — pre-configured Safe

A Sepolia Safe with `NoxGuardModule` already enabled and a spend policy already set is available for testing:

> Safe address: `0xD465929D06d757fEA8fe2da0d93F99972A0E870A`
>
> Policy: whitelisted target `0x58F96F255286c165B03507C5f4Fa58c64c93fF9a`, max 0.1 ETH per tx, 0.1 ETH per day

You can also set up your own Safe — the full module enable and policy setup flow works with any Sepolia Safe at [noxsafe.website/app/safe](https://noxsafe.website/app/safe).

> **Before submitting:** check the Safe's ETH balance on [Sepolia Etherscan](https://sepolia.etherscan.io/address/0xD465929D06d757fEA8fe2da0d93F99972A0E870A) first. The Safe holds ~0.07 ETH; if prior judges have depleted it, use **0 ETH** as the value — the oracle still fully exercises the Nox encryption and proof-verification path, it just sends an empty transfer. Any non-zero value that exceeds the Safe's balance will cause the oracle to silently fail and the intent to stay Pending indefinitely.

1. Go to [noxsafe.website/app/safe](https://noxsafe.website/app/safe), connect any Sepolia wallet
2. Enter the Safe address above
3. Go to **Submit Intent** — enter the whitelisted target `0x58F96F255286c165B03507C5f4Fa58c64c93fF9a`, ETH value ≤ Safe balance (or 0 ETH), click **Encrypt & Submit**
4. The oracle fulfills within ~30 seconds — the intent status flips Pending → Executed
5. Confirm on [NoxGuardModule events](https://sepolia.etherscan.io/address/0xa517298b74c058c7AC8c7614C3c84CC5f1b2a311#events)

---

## Safe App

Nox-Safe is registered as a Safe App and can be loaded directly inside the Safe{Wallet} interface at [app.safe.global](https://app.safe.global).

**To open Nox-Safe inside Safe:**

1. In Safe{Wallet}, go to **Apps → Custom Apps**
2. Paste `https://noxsafe.website` and click **Add**
3. Nox-Safe loads in the embedded dApp browser — the connected Safe address is detected automatically via `@safe-global/safe-apps-sdk`, so no manual address entry is required
4. The wallet is the Safe itself, so all signing flows work natively

**Technical notes:**
- `public/manifest.json` declares the app name, description, and supported networks (Sepolia, chainId 11155111)
- `vercel.json` includes a `Content-Security-Policy: frame-ancestors` header permitting embedding from `app.safe.global`
- `safe()` is registered as the first wagmi connector, so Safe's injected provider is preferred when available
- When the SDK detects a Safe App context (1.5 s handshake timeout), `safeAddress` is auto-populated and the "Connect your Safe" entry screen is skipped entirely

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

Stores per-Safe spend policies: an array of whitelisted target addresses, a max ETH value per transaction, and a max ETH value per UTC day. Any address can call `setPolicy`, but the policy is stored against `msg.sender` — so an EOA writing a policy can only affect their own address slot, not any Safe's. In the `NoxGuardModule` flow, `setPolicy` is always called via a Safe multisig transaction, making the Safe itself the `msg.sender`. Policies for a given Safe cannot be changed by any single signer — only by a transaction that meets the multisig threshold.

### NoxRecipientProxy — Sablier integration

A shielded recipient wrapper for Sablier V2 Lockup streams.

- Stream creator creates a Sablier stream with `NoxRecipientProxy` as the Sablier recipient (NFT holder).
- Stream creator calls `registerShieldedStream`, passing an encrypted end-recipient handle. Only the actual stream sender can call this; the proxy must already be the Sablier recipient.
- Anyone calls `requestShieldedWithdraw` when funds are vested and withdrawable.
- The oracle calls `fulfillShieldedWithdraw`, which verifies the Nox proof on-chain and calls `sablier.withdrawMax(streamId, realRecipient)` directly.

### nox-task oracle daemon

A Node.js polling process (ethers v6) that listens for `IntentSubmitted` and `ShieldedWithdrawRequested` events. For each event it fetches the raw decryption proof from `https://gateway-testnets.noxprotocol.dev`, decodes the plaintext via the trailing 32 bytes of the proof, validates off-chain, then submits the fulfill transaction. On startup it scans the last 100 blocks to catch any intents that arrived while it was offline.

### Chrome Extension

A Manifest V3 extension that injects context-aware buttons into two dapps:

- **app.safe.global** — on pages where a real Safe is selected (`?safe=<network>:0x...` in the URL), adds a floating "Shield with Nox" button and an inline button next to Safe's execute/sign controls. Auto-detects target address and value from Safe's form fields, encrypts via the Nox gateway, and submits to `NoxGuardModule` through MetaMask.
- **app.sablier.com** — on any stream page, adds a floating "Pay with NoxPay" button. On stream detail pages, auto-detects the stream ID from the URL and opens NoxPay's withdrawal page with the stream pre-filled.

The popup displays both product cards (Nox-Safe and NoxPay) linking to [noxsafe.website](https://noxsafe.website), plus a live Nox-Safe dashboard (oracle status, daily spend, policy caps) for any detected Safe address.

---

## Deployed Contracts — Sepolia

| Contract | Address | Etherscan |
|---|---|---|
| `PolicyRegistry` | `0xf3812133f47cDEa7cfc11E75e0DeAdE149fD7650` | [view](https://sepolia.etherscan.io/address/0xf3812133f47cDEa7cfc11E75e0DeAdE149fD7650) |
| `NoxGuardModule` | `0xa517298b74c058c7AC8c7614C3c84CC5f1b2a311` | [view](https://sepolia.etherscan.io/address/0xa517298b74c058c7AC8c7614C3c84CC5f1b2a311) |
| `NoxRecipientProxy` | `0xc8E18A3F8386D00A7095A49eABa0F1265f7dc3F0` | [view](https://sepolia.etherscan.io/address/0xc8E18A3F8386D00A7095A49eABa0F1265f7dc3F0) |
| `SablierV2LockupLinear` v1.1.2 (Sepolia, Sablier-deployed) | `0x7a43F8a888fa15e68C103E18b0439Eb1e98E4301` | [view](https://sepolia.etherscan.io/address/0x7a43F8a888fa15e68C103E18b0439Eb1e98E4301) |
| `NoxCompute` (iExec, used by Nox SDK) | `0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF` | [view](https://sepolia.etherscan.io/address/0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF) |

> On-chain proof verification is handled by `Nox.publicDecrypt()` in the iExec Nox SDK, which calls `NoxCompute` — there is no separately deployed NoxVerifier contract. `MockSafe` and `MockSablierLockup` are Hardhat test helpers deployed to Sepolia for the test suite only; they are not part of the production system.

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
│       ├── pages/          Dashboard, SubmitIntent, NoxPayLanding, NoxPayCompany, NoxPayEmployee, …
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
NOX_GUARD_MODULE=0xa517298b74c058c7AC8c7614C3c84CC5f1b2a311
POLICY_REGISTRY=0xf3812133f47cDEa7cfc11E75e0DeAdE149fD7650
NOX_RECIPIENT_PROXY=0xc8E18A3F8386D00A7095A49eABa0F1265f7dc3F0
```

The oracle wallet address must match the `noxOracle` value stored in `NoxGuardModule`. The initial oracle is set to the deployer address at deploy time. To change it: call `NoxGuardModule.setNoxOracle(newOracleAddress)` from the owner wallet.

**Start:**

```bash
npm start
```

The daemon scans the last 100 blocks on startup, then polls every 12 seconds. All steps are logged with `[nox-task]` prefix.

---

### 4. Chrome Extension

No build step required. See [extension/INSTALL.md](extension/INSTALL.md) for a step-by-step guide with GIF walkthrough.

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. **Load unpacked** → select the `extension/` folder
4. Go to `https://app.safe.global` and open an existing Safe, or visit `https://app.sablier.com`

On Safe: the floating "Shield with Nox" button appears only on transactional pages where a Safe is selected (`?safe=...` in the URL). On Sablier: a "Pay with NoxPay" button appears on all pages; stream detail pages auto-detect the stream ID and pre-fill the NoxPay withdrawal form.

---

## Usage Walkthrough

### Safe Flow

**Step 1 — Enable the module on your Safe**

`NoxGuardModule` must be enabled as a Safe module via a multisig transaction:

1. Connect your wallet and enter your Safe address in the web app
2. Click **Enable Module** — this proposes a Safe transaction with calldata:
   ```
   0x610b59250000000000000000000000001ba951e0883e5f4afedcdf88b76b8eef34165a51
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

### NoxPay — Shielded Payroll Flow

**Company: Create a shielded stream**

1. Go to `/app/noxpay` and click **I'm a Company**, or navigate directly to `/app/noxpay/company`
2. Fill in: recipient wallet address, ERC-20 token address, total amount, stream duration
3. Click **Create Shielded Stream** — the app runs four steps in sequence:
   - Approves Sablier to spend the ERC-20 token (one-time per token)
   - Creates a Sablier LockupLinear stream with `NoxRecipientProxy` as the on-chain recipient
   - Encrypts the real recipient's wallet address inside the Nox TEE
   - Calls `NoxRecipientProxy.registerShieldedStream` — binding the encrypted handle to the stream on-chain
4. The stream ID is shown on the success screen — share it with the employee

**Employee: Request a withdrawal**

1. Go to `/app/noxpay/employee` and enter the stream ID your employer shared
2. The app reads on-chain data and shows: token, total deposited, vested so far, withdrawable now
3. When withdrawable amount is > 0, click **Request Shielded Withdrawal** — calls `requestShieldedWithdraw` and emits `ShieldedWithdrawRequested`
4. The oracle picks up the event within ~30 seconds, decrypts the recipient inside the TEE, verifies `Nox.publicDecrypt` on-chain, and calls `sablier.withdrawMax(streamId, realRecipient)` — tokens land at the decrypted wallet

---

## Try It Yourself — NoxPay

NoxPay works with any ERC-20 token and any Sablier V2 LockupLinear stream on Sepolia. No pre-seeded data — the entire flow runs from your own wallet.

**Create a shielded stream:**

1. Get a Sepolia ERC-20 token (e.g. any testnet token, or deploy your own minimal ERC-20)
2. Go to [noxsafe.website/app/noxpay](https://noxsafe.website/app/noxpay) and connect a Sepolia wallet
3. Fill in: recipient wallet address, token contract address, amount, duration
4. Click **Create Shielded Stream** — the app handles ERC-20 approval, Sablier stream creation, Nox TEE encryption, and proxy registration in sequence
5. The stream ID is shown on the success screen — share it with the recipient

**Request a withdrawal:**

1. Go to [noxsafe.website/app/noxpay/employee](https://noxsafe.website/app/noxpay/employee)
2. Enter the stream ID your employer shared
3. Click **Request Shielded Withdrawal** — emits `ShieldedWithdrawRequested` on-chain
4. The oracle picks it up within ~30 seconds, decrypts the recipient inside the Nox TEE, verifies `Nox.publicDecrypt` on-chain, calls `sablier.withdrawMax(streamId, recipient)` — tokens land at the decrypted recipient wallet

To verify the proof fired: [Etherscan → NoxRecipientProxy events](https://sepolia.etherscan.io/address/0xc8E18A3F8386D00A7095A49eABa0F1265f7dc3F0#events) → look for `ShieldedWithdrawExecuted` after your request.

**View your streams (Company):**

Go to [noxsafe.website/app/noxpay/company](https://noxsafe.website/app/noxpay/company) → **My Streams** tab — streams you created are auto-discovered from on-chain `StreamShielded` events. No manual ID entry needed.

---

## Production Architecture

Currently the oracle runs as a standard Node.js process. The oracle operator can observe decrypted transaction details — target address and ETH value — during processing. `Nox.publicDecrypt` enforces on-chain proof verification, so the oracle cannot execute transactions that weren't authorized by the submitter, but it can see what those transactions contain.

The target architecture packages the oracle as a Docker image deployed as an iExec worker app inside an SGX enclave — the runtime Nox is specifically designed for. Decryption happens inside hardware-verified isolation: the operator cannot inspect memory, and remote attestation lets anyone verify the enclave code matches the published image. The path there is straightforward: containerize `nox-task`, register it as an iExec app, and configure a perpetual deal so the worker runs continuously. No contract changes are needed.

---

## Known Limitations

**Calldata privacy gap (v1).** Transaction calldata (`data`) is cleartext. Its `keccak256` hash is committed at intent submission so the oracle cannot swap it out, but the calldata itself is visible in the `IntentSubmitted` event. For native ETH transfers (`data = 0x`) there is nothing to leak. For ERC-20 transfers or DeFi calls where the recipient address is encoded in the calldata, that recipient is readable. Encrypting arbitrary-length calldata requires a `euint8[]` or `eBytes` Nox type — a v2 item.

**Oracle liveness dependency.** Submitted intents remain in `Pending` state indefinitely if the oracle is offline. There is no on-chain timeout, no fallback executor, and no permissionless cancellation path for the submitter. The daemon scans the last 100 blocks (~20 minutes) on startup — intents submitted during an oracle downtime longer than 20 minutes will be missed and require manual resubmission. In production this needs a heartbeat timeout, a longer startup lookback (or a subgraph), and a fallback mechanism.

**Block timestamp for daily cap reset.** The daily spend cap resets per `block.timestamp / 86400`. Validators can shift `block.timestamp` by a small amount, making the midnight reset boundary approximate. Not a material issue at the value ranges used in v1.

**Policy updates require a full Safe multisig tx.** There is no delegated admin role. Updating the whitelist or caps requires assembling, signing, and executing a new Safe transaction with owner quorum. This is intentional for security but creates friction for teams that adjust policy frequently.

**Event-log based history (no subgraph).** The transaction history page fetches `IntentSubmitted` events via `getLogs` filtered by the Safe address, using 6 parallel 9,000-block chunks via DRPC (~54,000 blocks, roughly 7.5 days). This covers the typical use window but does not provide a full audit trail back to genesis. A subgraph or off-chain indexer would be needed for exhaustive historical lookups across arbitrary time ranges.

**Oracle is a trusted party for decrypted content.** The oracle must decrypt the target address and value to validate and submit `fulfillIntent`. It observes all transaction details during processing. `Nox.publicDecrypt` verifies proofs on-chain, preventing the oracle from executing unauthorized transactions, but does not prevent the oracle operator from observing transaction contents. In production, the oracle should be run inside a TEE enclave with remote attestation, removing operator visibility.

**Oracle owner key and deployer are the same address.** In this build the deployer EOA is also the oracle wallet and the `NoxGuardModule` contract owner (who can call `setNoxOracle`). A compromised deployer key could redirect all intent fulfillment through a malicious oracle address without any time delay. In production, the deployer key, oracle key, and contract owner role should be separated, with a timelock or multisig required to change the oracle address.

**Oracle daily cap check asymmetry.** The oracle pre-validates the per-transaction cap off-chain and calls `rejectIntent` directly if exceeded. The daily cap check is handled by the contract's soft-reject path inside `fulfillIntent` — this means a daily cap violation costs the oracle one transaction's gas before being rejected on-chain. Intentional trade-off for v1.

**WalletConnect is optional.** A placeholder WalletConnect project ID was replaced with a proper opt-in env var (`VITE_WC_PROJECT_ID`) during development. WalletConnect is skipped entirely if the env var is absent — MetaMask and Coinbase Wallet work out of the box.

---

## Production Readiness Roadmap

The v1 build delivers end-to-end transaction privacy on real infrastructure. The items below mark the path to a mainnet-grade deployment.

**1. Full calldata encryption (`externalEbytes` handle).** The current build encrypts target address and ETH value but leaves transaction calldata cleartext — meaning ERC-20 transfers and DeFi calls still leak the encoded recipient in the `IntentSubmitted` event. The fix is a Nox `eBytes` or `euint8[]` handle for arbitrary-length calldata, which would make the entire transaction opaque until oracle fulfillment. No contract interface changes are needed; `submitIntent` gains a third encrypted parameter and the oracle decodes it the same way.

**2. Decentralized K-of-N oracle committee with intent expiry.** A single oracle is a liveness dependency and a trust assumption — if it goes offline, intents pend forever; if its key is compromised, all fulfillment is at risk. The path forward is a threshold oracle committee (e.g. 3-of-5) where each member runs the oracle daemon inside an SGX enclave with remote attestation, and a submitter-triggered expiry window (e.g. 24 hours) that cancels and refunds gas if no quorum is reached. iExec's existing worker pool is the natural substrate for this.

**3. O(1) policy whitelist lookups and multi-asset spend caps.** `PolicyRegistry` currently stores whitelisted targets as a dynamic array, making `isTargetWhitelisted` an O(n) linear scan — acceptable for small whitelists but a gas DoS vector if a Safe whitelists hundreds of addresses. A `mapping(address => mapping(address => bool))` lookup table brings this to O(1). A parallel upgrade would extend spend caps from ETH-only to per-ERC-20-token caps, so a DAO treasury policy can limit USDC outflows independently of ETH outflows.

**4. Gasless EIP-712 relay for anonymous intent submission.** Currently `submitIntent` must be called by the user's own wallet, linking their address to the intent on-chain even though the transaction contents are encrypted. A meta-transaction relay (EIP-712 signed payload, forwarded by a permissionless relayer) would break this link entirely — the submitter's identity never appears in the transaction origin. Combined with full calldata encryption, this closes the last metadata leakage vector and makes the submission phase genuinely unlinkable.

**5. EIP-712 meta-transaction relay (`submitIntentWithSig`).** Even with encrypted handles, the wallet that calls `submitIntent` is visible as the transaction origin — creating a metadata link between the submitter's identity and the Safe's activity. A `submitIntentWithSig` entrypoint accepts an EIP-712 signature and lets a permissionless relayer post the transaction on the user's behalf, so the submitter's address never appears on-chain. This closes the last remaining privacy gap for native ETH transfers and is fully compatible with the existing oracle fulfillment path.

**6. NoxPay recipient-only withdrawal access control.** Currently any address can call `requestShieldedWithdraw` on any registered stream, which lets a third party trigger oracle work and incur gas on an employee's behalf. Once a recipient proves their identity via a Nox attestation, their decrypted address can be stored as the sole authorized caller for future withdrawal requests on their stream — ensuring employees retain exclusive control over when funds move, and preventing unsolicited oracle invocations.

**7. Batch withdrawal (`batchRequestShieldedWithdraw`).** Employees with multiple active streams, or payroll operators managing many recipients, currently must submit one `requestShieldedWithdraw` transaction per stream — each triggering a separate oracle round-trip and confirmation wait. A batch entrypoint accepts an array of stream IDs, emits all `ShieldedWithdrawRequested` events in a single transaction, and lets the oracle fulfill them in parallel. This reduces gas overhead and oracle latency proportionally for payroll-scale use cases.

---

## Feedback

See [feedback.md](./feedback.md) for developer experience notes on building with the iExec Nox SDK.

---

## License

MIT
