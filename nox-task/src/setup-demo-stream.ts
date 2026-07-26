/**
 * Sets up (or resets) the demo Sablier shielded stream for hackathon judges.
 *
 * Uses the REAL Sablier V2 LockupLinear on Sepolia with a freshly deployed
 * DemoToken (NDT) so the entire oracle flow — token transfer, Nox TEE proof,
 * withdrawMax to the decrypted recipient — runs against production contracts.
 *
 * Design for multi-judge testing:
 *   The stream has cliff=0 and a 30-day total duration. Each second produces
 *   ~0.38 NDT of new withdrawable amount. After any judge drains the stream,
 *   within ~3 seconds there is fresh withdrawable amount for the next judge.
 *   No manual reset is needed between judges.
 *
 * Run once to set up:
 *   cd nox-task
 *   npm run setup-demo
 *
 * After the first run, copy the printed stream ID into:
 *   frontend/src/config/contracts.ts → ADDRESSES.DemoStreamId
 * Then rebuild and redeploy the frontend (Vercel auto-deploys on git push).
 *
 * Re-running setup-demo after the first run is safe (idempotent via state file).
 *
 * Prerequisites (one-time):
 *   cd contracts && npm run compile    # builds DemoToken artifact
 */

import "dotenv/config";
import { ethers } from "ethers";
import { createHandleClient } from "@iexec-nox/handle";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dir     = dirname(__filename);

// ── Paths ─────────────────────────────────────────────────────────────────────

const ARTIFACT_PATH  = join(__dir, "../../contracts/artifacts/contracts/DemoToken.sol/DemoToken.json");
const STATE_PATH     = join(__dir, "../.demo-state.json");

// ── Constants ─────────────────────────────────────────────────────────────────

const REAL_SABLIER  = "0xAFb979d9afAd1aD27C5eFf4E27226E3AB9e5dCC9";
const NOX_PROXY     = "0x1D9f855d88e526745fDb8b04Fe3180a274604172";
const DEMO_RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // Vitalik — memorable

// 10 million NDT with 18 decimals. At cliff=0 / 30-day total, the vesting rate
// is ~3.86 NDT/second, so withdrawableAmountOf > 0 within 1 second of any drain.
const TOTAL_AMOUNT   = 10_000_000n * 10n ** 18n;
const CLIFF_SECS     = 0n;
const TOTAL_SECS     = 30n * 24n * 60n * 60n; // 30 days

// ── State ─────────────────────────────────────────────────────────────────────

interface DemoState {
  tokenAddress: string;
  streamId: string;
  registeredOnProxy: boolean;
}

function loadState(): Partial<DemoState> {
  if (!existsSync(STATE_PATH)) return {};
  try { return JSON.parse(readFileSync(STATE_PATH, "utf8")); }
  catch { return {}; }
}

function saveState(s: DemoState) {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

// ── ABIs ──────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function name() view returns (string)",
];

// Sablier V2.2 (with transferable). The contract at REAL_SABLIER was deployed
// by the Sablier team — if it's V2.1 (without transferable), the call will revert
// with a clear ABI mismatch; set SABLIER_VERSION=v2.1 in .env to switch.
const SABLIER_ABI_V22 = [
  "function nextStreamId() view returns (uint256)",
  "function getSender(uint256 streamId) view returns (address)",
  "function getRecipient(uint256 streamId) view returns (address)",
  "function withdrawableAmountOf(uint256 streamId) view returns (uint128)",
  `function createWithDurations(
    (address sender,
     address recipient,
     uint128 totalAmount,
     address asset,
     bool cancelable,
     bool transferable,
     (uint40 cliff, uint40 total) durations,
     (address account, uint256 fee) broker) params
  ) returns (uint256)`,
];

const SABLIER_ABI_V21 = [
  "function nextStreamId() view returns (uint256)",
  "function getSender(uint256 streamId) view returns (address)",
  "function getRecipient(uint256 streamId) view returns (address)",
  "function withdrawableAmountOf(uint256 streamId) view returns (uint128)",
  `function createWithDurations(
    (address sender,
     address recipient,
     uint128 totalAmount,
     address asset,
     bool cancelable,
     (uint40 cliff, uint40 total) durations,
     (address account, uint256 fee) broker) params
  ) returns (uint256)`,
];

const PROXY_ABI = [
  "function registerShieldedStream(address sablier, uint256 streamId, bytes32 recipientHandle, bytes recipientProof)",
  "function getShieldedStream(address sablier, uint256 streamId) view returns ((address sablier, uint256 streamId, bytes32 recipientHandle, address sender, bool active))",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`[setup-demo] ${msg}`); }

async function getSablierContract(signer: ethers.Wallet): Promise<ethers.Contract> {
  const useV21 = process.env.SABLIER_VERSION === "v2.1";
  if (useV21) {
    log("Using Sablier V2.1 ABI (SABLIER_VERSION=v2.1)");
    return new ethers.Contract(REAL_SABLIER, SABLIER_ABI_V21, signer);
  }
  return new ethers.Contract(REAL_SABLIER, SABLIER_ABI_V22, signer);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Env & provider ──────────────────────────────────────────────────────────
  const rpc = process.env.SEPOLIA_RPC_URL;
  const key = process.env.ORACLE_PRIVATE_KEY;
  if (!rpc || !key) throw new Error("Missing SEPOLIA_RPC_URL or ORACLE_PRIVATE_KEY in .env");

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer   = new ethers.Wallet(key, provider);
  const balance  = await provider.getBalance(signer.address);

  console.log(`\n[setup-demo] Wallet : ${signer.address}`);
  console.log(`[setup-demo] Balance: ${ethers.formatEther(balance)} ETH`);
  if (balance < ethers.parseEther("0.01")) {
    console.warn("[setup-demo] WARNING: low ETH — you need ~0.01 ETH to pay gas for all steps.");
  }

  // ── Load DemoToken artifact ──────────────────────────────────────────────────
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error(
      `DemoToken artifact not found at ${ARTIFACT_PATH}.\n` +
      `Run first:  cd contracts && npm run compile`
    );
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as {
    abi: ethers.InterfaceAbi;
    bytecode: string;
  };

  const state   = loadState();
  const sablier = await getSablierContract(signer);
  const proxy   = new ethers.Contract(NOX_PROXY, PROXY_ABI, signer);

  // ── 1. Deploy DemoToken if missing ──────────────────────────────────────────
  let tokenAddress = state.tokenAddress;

  if (!tokenAddress) {
    log("Deploying DemoToken (NDT)...");
    const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    tokenAddress = await contract.getAddress();
    log(`DemoToken deployed: ${tokenAddress}`);
    log(`Etherscan: https://sepolia.etherscan.io/address/${tokenAddress}`);
    saveState({ tokenAddress, streamId: state.streamId ?? "", registeredOnProxy: false });
  } else {
    log(`DemoToken already deployed: ${tokenAddress}`);
  }

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

  // ── 2. Mint tokens to oracle wallet if balance is low ───────────────────────
  const tokenBalance = await token.balanceOf(signer.address);
  if (tokenBalance < TOTAL_AMOUNT) {
    const mintAmount = TOTAL_AMOUNT - tokenBalance;
    log(`Minting ${ethers.formatUnits(mintAmount, 18)} NDT to oracle wallet...`);
    const tx = await token.mint(signer.address, mintAmount);
    await tx.wait();
    log(`Minted. New balance: ${ethers.formatUnits(await token.balanceOf(signer.address), 18)} NDT`);
  } else {
    log(`Oracle wallet has ${ethers.formatUnits(tokenBalance, 18)} NDT — no mint needed.`);
  }

  // ── 3. Approve Sablier to spend tokens ──────────────────────────────────────
  const allowance = await token.allowance(signer.address, REAL_SABLIER);
  if (allowance < TOTAL_AMOUNT) {
    log(`Approving Sablier V2 to spend ${ethers.formatUnits(TOTAL_AMOUNT, 18)} NDT...`);
    const tx = await token.approve(REAL_SABLIER, TOTAL_AMOUNT);
    await tx.wait();
    log("Approved.");
  } else {
    log(`Sablier allowance already sufficient (${ethers.formatUnits(allowance, 18)} NDT).`);
  }

  // ── 4. Create stream on real Sablier V2 ──────────────────────────────────────
  let streamId = state.streamId ? BigInt(state.streamId) : undefined;

  if (!streamId) {
    // Predict the stream ID before creating
    const nextId: bigint = await sablier.nextStreamId();
    log(`\nCreating real Sablier V2 stream (predicted ID: ${nextId})...`);
    log(`  Sablier contract : ${REAL_SABLIER}`);
    log(`  Token (NDT)      : ${tokenAddress}`);
    log(`  Total amount     : ${ethers.formatUnits(TOTAL_AMOUNT, 18)} NDT`);
    log(`  Duration         : 30 days, no cliff`);
    log(`  Recipient        : ${NOX_PROXY} (NoxRecipientProxy)`);

    const useV21 = process.env.SABLIER_VERSION === "v2.1";

    let tx: ethers.ContractTransactionResponse;
    try {
      if (useV21) {
        tx = await sablier.createWithDurations({
          sender: signer.address,
          recipient: NOX_PROXY,
          totalAmount: TOTAL_AMOUNT,
          asset: tokenAddress,
          cancelable: true,
          durations: { cliff: CLIFF_SECS, total: TOTAL_SECS },
          broker:    { account: ethers.ZeroAddress, fee: 0n },
        });
      } else {
        tx = await sablier.createWithDurations({
          sender: signer.address,
          recipient: NOX_PROXY,
          totalAmount: TOTAL_AMOUNT,
          asset: tokenAddress,
          cancelable: true,
          transferable: false,
          durations: { cliff: CLIFF_SECS, total: TOTAL_SECS },
          broker:    { account: ethers.ZeroAddress, fee: 0n },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("no matching fragment") || msg.includes("ABI") || msg.includes("function")) {
        throw new Error(
          `Sablier ABI mismatch. If the contract is V2.1, set SABLIER_VERSION=v2.1 in .env and re-run.\n` +
          `Original error: ${msg}`
        );
      }
      throw err;
    }

    const receipt = await tx.wait();
    if (!receipt) throw new Error("No transaction receipt received");

    // Confirm stream was created with the predicted ID
    const actualSender = await sablier.getSender(nextId);
    if (actualSender.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error(
        `Stream ID mismatch: expected sender ${signer.address} at ID ${nextId}, ` +
        `got ${actualSender}. Another stream may have been created concurrently. Re-run setup-demo.`
      );
    }

    streamId = nextId;
    log(`Stream created! ID: ${streamId}`);
    log(`Etherscan: https://sepolia.etherscan.io/tx/${receipt.hash}`);
    saveState({ tokenAddress, streamId: streamId.toString(), registeredOnProxy: false });
  } else {
    log(`\nStream already created (ID: ${streamId}) — skipping.`);
    const sender = await sablier.getSender(streamId);
    if (sender.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error(
        `Stream ${streamId} sender is ${sender}, but your wallet is ${signer.address}. ` +
        `Delete .demo-state.json and re-run with the wallet that created the stream.`
      );
    }
  }

  // ── 5. Register encrypted recipient on NoxRecipientProxy ────────────────────
  const existing = await proxy.getShieldedStream(REAL_SABLIER, streamId);

  if (!existing.active) {
    log(`\nEncrypting recipient address via Nox TEE SDK...`);
    const handleClient = await createHandleClient(signer);
    const { handle, handleProof } = await handleClient.encryptInput(
      BigInt(DEMO_RECIPIENT),
      "uint256",
      NOX_PROXY as `0x${string}`
    );
    log(`handle: ${handle}`);

    log(`Registering shielded stream on NoxRecipientProxy...`);
    const tx2 = await proxy.registerShieldedStream(
      REAL_SABLIER,
      streamId,
      handle,
      handleProof
    );
    const receipt2 = await tx2.wait();
    log(`Registered. tx: ${receipt2.hash}`);
    log(`Etherscan: https://sepolia.etherscan.io/tx/${receipt2.hash}`);
    saveState({ tokenAddress, streamId: streamId.toString(), registeredOnProxy: true });
  } else {
    log(`\nStream already registered on NoxRecipientProxy — skipping.`);
    log(`  handle: ${existing.recipientHandle}`);
  }

  // ── 6. Verify withdrawable amount is non-zero ────────────────────────────────
  const withdrawable: bigint = await sablier.withdrawableAmountOf(streamId);
  log(`\nCurrent withdrawable: ${ethers.formatUnits(withdrawable, 18)} NDT`);
  if (withdrawable === 0n) {
    // Stream was JUST created — tiny rounding. Should be non-zero within 1 block.
    log("NOTE: withdrawable is 0 right now (stream just created). It will be non-zero within ~12 seconds.");
  } else {
    log("Withdrawable is non-zero — judges can request a withdrawal immediately.");
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║        Live Sablier Demo Stream — Ready for Judges                   ║
╠══════════════════════════════════════════════════════════════════════╣
║  Sablier contract : ${REAL_SABLIER}  ║
║  Stream ID        : ${streamId.toString().padEnd(48)}║
║  Token (NDT)      : ${tokenAddress.padEnd(48)}║
║  Encrypted recip  : ${DEMO_RECIPIENT}  ║
╚══════════════════════════════════════════════════════════════════════╝

NEXT STEP (one-time after first run):
  Update frontend/src/config/contracts.ts:
    DemoStreamId: "${streamId.toString()}",

  Then push the frontend (Vercel will auto-deploy):
    git add frontend/src/config/contracts.ts
    git commit -m "chore: set DemoStreamId to ${streamId.toString()} for demo"
    git push

Judge flow (no setup needed):
  1. Go to https://noxsafe.vercel.app/app/sablier
  2. Click "Try Demo Stream" — pre-fills real Sablier address + stream ID
  3. Click "Request Shielded Withdrawal"
  4. Oracle fulfills in ~30s — NDT tokens land at Vitalik's address

Multi-judge: stream re-fills every second (30-day linear vest, no cliff).
After any drain, wait ~3s and withdrawableAmountOf is non-zero again.
`);
}

main().catch((err) => {
  console.error("[setup-demo] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
