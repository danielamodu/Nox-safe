/**
 * Sets up (or resets) the demo Sablier shielded stream for hackathon judges.
 *
 * Uses MockSablierLockup so no real ERC20 token is needed. The oracle flow
 * (encrypt → register → requestWithdraw → oracle fulfills) is fully real —
 * only the underlying token transfer is mocked.
 *
 * Idempotent:
 *   - Creates stream 1 on MockSablierLockup if not already created.
 *   - Registers the encrypted recipient on NoxRecipientProxy if not already registered.
 *   - Always resets the withdrawable amount so each judge gets a fresh test.
 *
 * Run:
 *   cd nox-task
 *   npm run setup-demo
 *
 * Re-run after each judge tests to reset the withdrawable amount.
 */

import "dotenv/config";
import { ethers } from "ethers";
import { createHandleClient } from "@iexec-nox/handle";

// ── Constants ────────────────────────────────────────────────────────────────

const STREAM_ID       = 1n;
const DEMO_RECIPIENT  = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // Vitalik's address — memorable test address
const MOCK_WITHDRAWABLE = 1_000_000n; // mock units, no real token

const MOCK_SABLIER = "0x518B1b36bcfA237c909380D56B6254052b350bb1";
const NOX_PROXY    = "0x1D9f855d88e526745fDb8b04Fe3180a274604172";

// ── ABIs ─────────────────────────────────────────────────────────────────────

const MOCK_SABLIER_ABI = [
  "function createStream(uint256 streamId, address sender, address recipient, uint128 withdrawableAmount, address token)",
  "function setWithdrawable(uint256 streamId, uint128 amount)",
  "function getSender(uint256 streamId) view returns (address)",
  "function getRecipient(uint256 streamId) view returns (address)",
  "function withdrawableAmountOf(uint256 streamId) view returns (uint128)",
];

const PROXY_ABI = [
  "function registerShieldedStream(address sablier, uint256 streamId, bytes32 recipientHandle, bytes recipientProof)",
  "function getShieldedStream(address sablier, uint256 streamId) view returns (tuple(address sablier, uint256 streamId, bytes32 recipientHandle, address sender, bool active))",
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const key = process.env.ORACLE_PRIVATE_KEY;
  if (!rpc || !key) throw new Error("Missing SEPOLIA_RPC_URL or ORACLE_PRIVATE_KEY in .env");

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer   = new ethers.Wallet(key, provider);

  const balance = await provider.getBalance(signer.address);
  console.log(`\n[setup-demo] Wallet:  ${signer.address}`);
  console.log(`[setup-demo] Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.005")) {
    console.warn("[setup-demo] Low balance — you may not have enough ETH to pay gas.");
  }

  const mockSablier = new ethers.Contract(MOCK_SABLIER, MOCK_SABLIER_ABI, signer);
  const proxy       = new ethers.Contract(NOX_PROXY, PROXY_ABI, signer);

  // ── 1. Create stream on MockSablierLockup if missing ───────────────────────

  const currentSender = await mockSablier.getSender(STREAM_ID);
  const streamExists  = currentSender !== ethers.ZeroAddress;

  if (!streamExists) {
    console.log(`\n[setup-demo] Creating demo stream on MockSablierLockup...`);
    const tx = await mockSablier.createStream(
      STREAM_ID,
      signer.address,         // sender — must match msg.sender for registerShieldedStream
      NOX_PROXY,              // recipient — NoxRecipientProxy must be the Sablier recipient
      MOCK_WITHDRAWABLE,
      ethers.ZeroAddress      // no ERC20 token; withdrawMax emits event but transfers nothing
    );
    const receipt = await tx.wait();
    console.log(`[setup-demo] Stream created. tx: ${receipt.hash}`);
    console.log(`[setup-demo] Etherscan: https://sepolia.etherscan.io/tx/${receipt.hash}`);
  } else {
    console.log(`\n[setup-demo] Stream ${STREAM_ID} already exists (sender: ${currentSender}) — skipping create.`);
    if (currentSender.toLowerCase() !== signer.address.toLowerCase()) {
      console.error(`[setup-demo] ERROR: stream sender is ${currentSender} but your wallet is ${signer.address}.`);
      console.error(`[setup-demo] registerShieldedStream will revert. Use the wallet that created the stream.`);
      process.exit(1);
    }
  }

  // ── 2. Register encrypted recipient on NoxRecipientProxy if missing ─────────

  const existing = await proxy.getShieldedStream(MOCK_SABLIER, STREAM_ID);

  if (!existing.active) {
    console.log(`\n[setup-demo] Encrypting recipient address via Nox TEE SDK...`);
    const handleClient = await createHandleClient(signer);
    const { handle, handleProof } = await handleClient.encryptInput(
      BigInt(DEMO_RECIPIENT),
      "uint256",
      NOX_PROXY as `0x${string}`
    );
    console.log(`[setup-demo] handle: ${handle}`);

    console.log(`[setup-demo] Registering shielded stream on NoxRecipientProxy...`);
    const tx2 = await proxy.registerShieldedStream(
      MOCK_SABLIER,
      STREAM_ID,
      handle,
      handleProof
    );
    const receipt2 = await tx2.wait();
    console.log(`[setup-demo] Registered. tx: ${receipt2.hash}`);
    console.log(`[setup-demo] Etherscan: https://sepolia.etherscan.io/tx/${receipt2.hash}`);
  } else {
    console.log(`\n[setup-demo] Stream already registered on NoxRecipientProxy (handle: ${existing.recipientHandle}) — skipping.`);
  }

  // ── 3. Always reset the withdrawable amount ────────────────────────────────
  // After each judge tests, withdrawMax sets withdrawableAmountOf to 0.
  // Re-running this script resets it so the next judge can withdraw again.

  const currentWithdrawable = await mockSablier.withdrawableAmountOf(STREAM_ID);
  console.log(`\n[setup-demo] Current withdrawable: ${currentWithdrawable}`);
  if (currentWithdrawable < MOCK_WITHDRAWABLE) {
    console.log(`[setup-demo] Resetting withdrawable amount to ${MOCK_WITHDRAWABLE}...`);
    const tx3 = await mockSablier.setWithdrawable(STREAM_ID, MOCK_WITHDRAWABLE);
    const receipt3 = await tx3.wait();
    console.log(`[setup-demo] Reset done. tx: ${receipt3.hash}`);
  } else {
    console.log(`[setup-demo] Withdrawable already at ${currentWithdrawable} — no reset needed.`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║          Demo Sablier Stream — Ready for Judges                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  Sablier contract : ${MOCK_SABLIER}         ║
║  Stream ID        : 1                                                ║
║  Encrypted recip  : ${DEMO_RECIPIENT}  ║
║  Withdrawable     : ${MOCK_WITHDRAWABLE.toString()} (mock units, no real token)           ║
╚══════════════════════════════════════════════════════════════════════╝

Judges:
  1. Go to https://noxsafe.vercel.app/app/sablier
  2. Click "Try Demo Stream" — pre-fills contract + stream ID
  3. Click "Request Shielded Withdrawal"
  4. Oracle fulfills within ~30 seconds

After each test run: npm run setup-demo  (resets withdrawable for the next judge)
`);
}

main().catch((err) => {
  console.error("[setup-demo] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
