/**
 * Validates the full handle lifecycle:
 * encryptInput → validateInputProof → allowPublicDecryption → publicDecrypt
 *
 * Run with: npx ts-node --esm test_chain.ts
 */
import "dotenv/config";
import { ethers } from "ethers";
import { createHandleClient } from "@iexec-nox/handle";

const ALCHEMY = process.env.SEPOLIA_RPC_URL!;
const ORACLE_KEY = process.env.ORACLE_PRIVATE_KEY!;
const NOX_COMPUTE = "0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf";
const NOX_GUARD_MODULE = process.env.NOX_GUARD_MODULE ?? "0xbb616000b55d256cEC4fb9E211f4138e43cbA2e5";

// Minimal ABI fragments
const COMPUTE_ABI = [
  "function validateInputProof(bytes32 handle, address owner, bytes proof, uint8 teeType)",
  "function allowPublicDecryption(bytes32 handle)",
  "function isPubliclyDecryptable(bytes32 handle) view returns (bool)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(ALCHEMY);
  const signer = new ethers.Wallet(ORACLE_KEY, provider);
  console.log("Wallet:", signer.address);

  const compute = new ethers.Contract(NOX_COMPUTE, COMPUTE_ABI, signer);
  const handleClient = await createHandleClient(signer);

  // ── Step 1: Encrypt a dummy value ──────────────────────────────────────────
  console.log("\n[1] Encrypting dummy target (address 0x000...001 as uint256)...");
  const dummyTarget = 1n; // uint256(uint160(address)) of address(1)
  const { handle, handleProof } = await handleClient.encryptInput(
    dummyTarget,
    "uint256",
    NOX_GUARD_MODULE as `0x${string}`
  );
  console.log("  handle:      ", handle);
  console.log("  handleProof: ", handleProof?.slice(0, 40) + "...");

  // Print the full handleProof so we can inspect it
  console.log("  full handleProof:", handleProof);

  // ── Step 2: validateInputProof (teeType = 0) ──────────────────────────────
  // Use eth_call to get the full revert data including the reason string
  const iface = new ethers.Interface([
    "function validateInputProof(bytes32 handle, address owner, bytes proof, uint8 teeType)",
    "error InvalidProof(bytes proof, string reason)",
    "error UndefinedHandle()",
    "error UnauthorizedSender(address sender)",
    "error InvalidEmptyBytes()",
  ]);

  for (const teeType of [0, 1, 2]) {
    const calldata = iface.encodeFunctionData("validateInputProof", [handle, signer.address, handleProof, teeType]);
    console.log(`\n[2/${teeType}] validateInputProof with teeType=${teeType}...`);
    try {
      await provider.call({ to: NOX_COMPUTE, data: calldata });
      console.log("  eth_call succeeded (simulation ok) — sending tx...");
      const tx = await compute.validateInputProof(handle, signer.address, handleProof, teeType);
      const receipt = await tx.wait();
      console.log("  ✓ mined:", receipt.hash);
      break; // success — continue
    } catch (e: any) {
      const data: string = e.data ?? e.error?.data ?? "";
      if (data && data.startsWith("0x")) {
        try {
          const decoded = iface.parseError(data);
          console.error("  ✗ revert:", decoded?.name, decoded?.args);
        } catch {
          console.error("  ✗ raw revert data:", data.slice(0, 300));
        }
      } else {
        console.error("  ✗", e.shortMessage ?? e.message?.slice(0, 200));
      }
      if (teeType === 2) { console.error("All teeTypes failed"); process.exit(1); }
    }
  }

  // ── Step 3: allowPublicDecryption ─────────────────────────────────────────
  console.log("\n[3] allowPublicDecryption(handle)...");
  try {
    const tx = await compute.allowPublicDecryption(handle);
    const receipt = await tx.wait();
    console.log("  ✓ allowPublicDecryption mined:", receipt.hash);
  } catch (e: any) {
    console.error("  ✗ allowPublicDecryption FAILED:", e.reason ?? e.message?.slice(0, 200));
    process.exit(1);
  }

  // ── Step 4: check isPubliclyDecryptable ───────────────────────────────────
  const isPublic = await compute.isPubliclyDecryptable(handle);
  console.log("\n[4] isPubliclyDecryptable:", isPublic);
  if (!isPublic) {
    console.error("  ✗ Still not publicly decryptable after allowPublicDecryption!");
    process.exit(1);
  }

  // ── Step 5: publicDecrypt ─────────────────────────────────────────────────
  console.log("\n[5] publicDecrypt(handle)...");
  try {
    const { value, solidityType } = await handleClient.publicDecrypt(handle);
    console.log("  ✓ Decrypted value:", value, "type:", solidityType);
    console.log("\n✅ Full chain WORKS. Frontend flow should succeed.");
  } catch (e: any) {
    console.error("  ✗ publicDecrypt FAILED:", e.message?.slice(0, 300));
    process.exit(1);
  }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
