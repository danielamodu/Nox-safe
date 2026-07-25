/**
 * End-to-end chain test: encrypts two handles with the new NoxGuardModule as
 * applicationContract, calls submitIntent (which calls validateInputProof +
 * allowPublicDecryption internally), then calls publicDecrypt to confirm
 * the oracle can read the values.
 *
 * Run with: npx ts-node --esm test_submit.ts
 */
import "dotenv/config";
import { ethers } from "ethers";
import { createHandleClient } from "@iexec-nox/handle";

const ALCHEMY = process.env.SEPOLIA_RPC_URL!;
const ORACLE_KEY = process.env.ORACLE_PRIVATE_KEY!;
const NOX_GUARD_MODULE = "0xB004821f6578Ad4124f3B1Ff2B326e705a414e2f";
const NOX_COMPUTE = "0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf";

// Use a dummy safe address (won't execute since the module isn't enabled on it).
// We just need submitIntent to run so it calls validateInputProof + allowPublicDecryption.
const DUMMY_SAFE = "0x0000000000000000000000000000000000000001";

const MODULE_ABI = [
  "function submitIntent(address safe, bytes32 targetHandle, bytes32 valueHandle, bytes data, bytes targetProof, bytes valueProof) returns (bytes32)",
];
const COMPUTE_ABI = [
  "function isPubliclyDecryptable(bytes32 handle) view returns (bool)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(ALCHEMY);
  const signer = new ethers.Wallet(ORACLE_KEY, provider);
  console.log("Wallet:", signer.address);

  const module = new ethers.Contract(NOX_GUARD_MODULE, MODULE_ABI, signer);
  const compute = new ethers.Contract(NOX_COMPUTE, COMPUTE_ABI, provider);
  const handleClient = await createHandleClient(signer);

  // ── 1. Encrypt with applicationContract = new NoxGuardModule ─────────────
  console.log("\n[1] Encrypting handles with applicationContract = new NoxGuardModule...");
  const TARGET_VALUE = 1n; // uint256(uint160(address(1)))
  const ETH_VALUE = ethers.parseEther("0.001");

  const { handle: targetHandle, handleProof: targetProof } = await handleClient.encryptInput(
    TARGET_VALUE, "uint256", NOX_GUARD_MODULE as `0x${string}`
  );
  const { handle: valueHandle, handleProof: valueProof } = await handleClient.encryptInput(
    ETH_VALUE, "uint256", NOX_GUARD_MODULE as `0x${string}`
  );
  console.log("  targetHandle:", targetHandle);
  console.log("  valueHandle:", valueHandle);

  // ── 2. Call submitIntent — NoxGuardModule calls validateInputProof + allowPublicDecryption internally ─
  console.log("\n[2] Calling submitIntent on new NoxGuardModule...");
  try {
    const tx = await module.submitIntent(
      DUMMY_SAFE,
      targetHandle,
      valueHandle,
      "0x", // empty calldata
      targetProof,
      valueProof,
    );
    const receipt = await tx.wait();
    console.log("  ✓ submitIntent mined:", receipt.hash);
  } catch (e: any) {
    const msg = e.reason ?? e.shortMessage ?? e.message?.slice(0, 400);
    console.error("  ✗ submitIntent FAILED:", msg);
    process.exit(1);
  }

  // ── 3. Check isPubliclyDecryptable ────────────────────────────────────────
  console.log("\n[3] Checking isPubliclyDecryptable...");
  const targetPublic = await compute.isPubliclyDecryptable(targetHandle);
  const valuePublic = await compute.isPubliclyDecryptable(valueHandle);
  console.log("  targetHandle:", targetPublic, valueHandle, valuePublic);

  if (!targetPublic || !valuePublic) {
    console.error("  ✗ Handles not publicly decryptable after submitIntent!");
    process.exit(1);
  }

  // ── 4. publicDecrypt — what the oracle does ───────────────────────────────
  console.log("\n[4] publicDecrypt (oracle path)...");
  try {
    const { value: tv } = await handleClient.publicDecrypt(targetHandle);
    const { value: vv } = await handleClient.publicDecrypt(valueHandle);
    const tBytes = tv instanceof Uint8Array ? tv : Buffer.from(tv.slice(2), "hex");
    const vBytes = vv instanceof Uint8Array ? vv : Buffer.from(vv.slice(2), "hex");
    const decoded = ethers.AbiCoder.defaultAbiCoder();
    const target = ethers.getAddress(ethers.toBeHex(decoded.decode(["uint256"], tBytes)[0] as bigint, 20));
    const wei = decoded.decode(["uint256"], vBytes)[0] as bigint;
    console.log("  ✓ Decrypted target:", target);
    console.log("  ✓ Decrypted value: ", ethers.formatEther(wei), "ETH");
    console.log("\n✅ Full chain WORKS — submitIntent registers handles and publicDecrypt succeeds.");
  } catch (e: any) {
    console.error("  ✗ publicDecrypt FAILED:", e.message?.slice(0, 400));
    process.exit(1);
  }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
