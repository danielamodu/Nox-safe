# Nox-Safe

**Confidential transaction guard for Safe multisig, powered by iExec Nox TEE.**

Built for the [iExec WTF!! Hackathon](https://iexec.io) — Write The Future, Summer Edition.

---

## What it does

Safe owners approve a **policy** once (whitelisted targets, value caps). Anyone can then submit an **encrypted trade intent**. The Nox TEE decrypts the intent, checks it against the policy, and executes it on the Safe if valid — without ever exposing the trade details on-chain before execution.

```
Owner signs policy once       → PolicyRegistry.setPolicy(...)
Trader submits encrypted tx   → NoxGuardModule.submitIntent(safe, encryptedIntent)
Nox TEE validates off-chain   → checks targets, value caps
TEE calls back on-chain       → NoxGuardModule.fulfillIntent(..., noxProof)
Safe executes                 → ISafe.execTransactionFromModule(...)
```

---

## Architecture

```
contracts/
  interfaces/
    ISafe.sol              Minimal Safe module interface
    IPolicyRegistry.sol    Policy struct + setPolicy/getPolicy
    INoxGuardModule.sol    submitIntent / fulfillIntent
    INoxVerifier.sol       Abstract Nox proof verifier
  PolicyRegistry.sol       Implementation
  NoxGuardModule.sol       Implementation

nox-task/
  src/index.ts             TEE task: decrypt → validate → callback

frontend/
  src/                     React + wagmi: policy builder, intent form, dashboard
```

### Why a Module, not a Guard

Safe's `checkTransaction` hook fires *after* the transaction is assembled in plaintext. For confidentiality the intent must stay encrypted until the TEE has validated it, so the logic lives in a Module + off-chain Nox call rather than a Guard hook.

---

## Contracts (Sepolia)

| Contract | Address |
|---|---|
| PolicyRegistry | [`0x4e2fDAe7B99F07D33f347f79e0f25781b5c517a0`](https://sepolia.etherscan.io/address/0x4e2fDAe7B99F07D33f347f79e0f25781b5c517a0#code) |
| NoxVerifier | [`0xBf4bc8ACCbd771AeFC68de80a4ED3fa5442DD70B`](https://sepolia.etherscan.io/address/0xBf4bc8ACCbd771AeFC68de80a4ED3fa5442DD70B#code) |
| NoxGuardModule | [`0x9E6a9180d3F4D94A3b4d469D4648b7eA25C34668`](https://sepolia.etherscan.io/address/0x9E6a9180d3F4D94A3b4d469D4648b7eA25C34668#code) |

---

## Policy v1

```solidity
struct Policy {
    address[] whitelistedTargets;
    uint256   maxValuePerTx;
    uint256   maxValuePerDay;
    bool      active;
}
```

**Out of scope (v2):** generic condition DSL (price ceilings, oracle checks). See `feedback.md` for notes on what a production version would need.

---

## Setup

### Prerequisites
- Node 20+
- An ETH Sepolia RPC endpoint (Infura / Alchemy)
- A funded Sepolia wallet

### Contracts

```bash
cd contracts
npm install
cp .env.example .env   # fill in SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY
npm run compile
npm run deploy:sepolia
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Nox Task

```bash
cd nox-task
npm install
# TODO: configure Nox SDK — see nox-task/src/index.ts
```

---

## Usage

1. Connect your wallet and select or deploy a Safe.
2. **Enable Module** — sign a Safe tx to call `enableModule(NoxGuardModule)`.
3. **Set Policy** — use the policy builder to whitelist targets and set value caps. Submit as a Safe tx (requires owner quorum).
4. **Submit Intent** — fill the intent form; the app encrypts it client-side with the Nox SDK and calls `submitIntent`.
5. **Dashboard** — monitor intents: Pending → Executed / Rejected. Decrypted params are shown once the TEE emits `IntentExecuted`.

---

## Future work (v2)

- Generic condition DSL: price oracle ceilings, time-of-day windows.
- Multi-step intents (flash-loan sequences).
- Gasless submission via ERC-4337 or meta-tx.

---

## Deliverables

- [x] Public GitHub repo
- [x] README (this file)
- [ ] Docs (see `docs/` — Day 6)
- [ ] Frontend (Day 6-7)
- [ ] Sepolia deployment (Day 2)
- [ ] `feedback.md` (ongoing)
- [ ] Demo video (Day 9)
- [ ] X post (Day 10)

---

## License

MIT
