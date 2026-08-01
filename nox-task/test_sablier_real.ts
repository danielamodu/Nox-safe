/**
 * End-to-end chain test for Nox-Sablier (NoxRecipientProxy):
 *  1. Creates a Sablier stream setting recipient to NoxRecipientProxy.
 *  2. Encrypts real recipient address using @iexec-nox/handle SDK with applicationContract = NoxRecipientProxy.
 *  3. Calls registerShieldedStream on Sepolia (calls Nox.fromExternal + Nox.allowPublicDecryption).
 *  4. Verifies handle is publicly decryptable on NoxCompute contract.
 *  5. Calls requestShieldedWithdraw on Sepolia.
 *  6. Fetches raw decryption proof from the real Nox Gateway (gateway-testnets.noxprotocol.dev).
 *  7. Decodes recipient address from gateway proof.
 *  8. Calls fulfillShieldedWithdraw on Sepolia, executing on-chain Nox.publicDecrypt signature verification and Sablier withdrawal.
 *
 * Run with: npx ts-node --esm test_sablier_real.ts
 */

import "dotenv/config";
import { ethers } from "ethers";
import { createHandleClient } from "@iexec-nox/handle";

const ALCHEMY = process.env.SEPOLIA_RPC_URL!;
const ORACLE_KEY = process.env.ORACLE_PRIVATE_KEY!;

const NOX_RECIPIENT_PROXY = "0xd707bE1206c174d4F15f133d1cB27Df3583d6A0b";
const MOCK_SABLIER = "0x518B1b36bcfA237c909380D56B6254052b350bb1";
const NOX_GATEWAY = "https://gateway-testnets.noxprotocol.dev";
const NOX_COMPUTE = "0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF";
const CHAIN_ID = 11155111;

const PROXY_ABI = [
  "function registerShieldedStream(address sablier, uint256 streamId, bytes32 recipientHandle, bytes recipientProof)",
  "function requestShieldedWithdraw(address sablier, uint256 streamId) returns (bytes32)",
  "function fulfillShieldedWithdraw(bytes32 requestId, address recipient, bytes recipientProof)",
  "function getWithdrawRequest(bytes32 requestId) view returns (tuple(address sablier, uint256 streamId, bytes32 recipientHandle, uint8 status, uint256 submittedAt))",
  "event ShieldedWithdrawRequested(bytes32 indexed requestId, address indexed sablier, uint256 indexed streamId, bytes32 recipientHandle)",
];

const SABLIER_ABI = [
  "function createStream(uint256 streamId, address sender, address recipient, uint128 amount, address token)",
  "function withdrawableAmountOf(uint256 streamId) view returns (uint128)",
];

const COMPUTE_ABI = [
  "function isPubliclyDecryptable(bytes32 handle) view returns (bool)",
];

async function fetchDecryptionProof(handle: string): Promise<string> {
  const url = `${NOX_GATEWAY}/v0/public/${handle}?chain_id=${CHAIN_ID}`;
  console.log(`  Fetching gateway proof: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gateway ${res.status} for handle ${handle}: ${await res.text()}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  const rawProof =
    ((json.payload as Record<string, unknown>)?.decryptionProof as string) ??
    ((json as Record<string, unknown>).decryptionProof as string) ??
    ((json as Record<string, unknown>).proof as string);
  if (!rawProof) throw new Error(`No decryptionProof in gateway response: ${JSON.stringify(json)}`);
  return rawProof.startsWith("0x") ? rawProof : "0x" + rawProof;
}

function extractPlaintext(rawProof: string): bigint {
  const plaintextHex = "0x" + rawProof.slice(2 + 65 * 2);
  return BigInt(plaintextHex);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(ALCHEMY);
  const signer = new ethers.Wallet(ORACLE_KEY, provider);
  console.log(`\n======================================================`);
  console.log(` Nox-Sablier Real Sepolia End-to-End Gateway Test`);
  console.log(`======================================================`);
  console.log(`Wallet Signer:     ${signer.address}`);
  console.log(`NoxRecipientProxy: ${NOX_RECIPIENT_PROXY}`);
  console.log(`MockSablierLockup: ${MOCK_SABLIER}\n`);

  const proxy = new ethers.Contract(NOX_RECIPIENT_PROXY, PROXY_ABI, signer);
  const sablier = new ethers.Contract(MOCK_SABLIER, SABLIER_ABI, signer);
  const compute = new ethers.Contract(NOX_COMPUTE, COMPUTE_ABI, provider);

  const handleClient = await createHandleClient(signer);
  const streamId = BigInt(Math.floor(Date.now() / 1000));
  const withdrawableAmount = ethers.parseEther("100");
  const realEndRecipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Test recipient wallet

  // 1. Create stream on Sablier with recipient = NoxRecipientProxy
  console.log(`[1] Creating Sablier stream ${streamId} with recipient = NoxRecipientProxy...`);
  const createTx = await sablier.createStream(
    streamId,
    signer.address,
    NOX_RECIPIENT_PROXY,
    withdrawableAmount,
    ethers.ZeroAddress
  );
  await createTx.wait();
  console.log(`  ✓ Sablier stream created in tx: ${createTx.hash}`);

  // 2. Encrypt real recipient address with applicationContract = NoxRecipientProxy
  console.log(`\n[2] Encrypting real recipient address (${realEndRecipient}) via Nox SDK...`);
  const recipientAsUint256 = BigInt(realEndRecipient);
  const { handle: recipientHandle, handleProof: recipientProof } = await handleClient.encryptInput(
    recipientAsUint256,
    "uint256",
    NOX_RECIPIENT_PROXY as `0x${string}`
  );
  console.log(`  ✓ Nox Recipient Handle: ${recipientHandle}`);

  // 3. Register shielded stream on Sepolia
  console.log(`\n[3] Calling registerShieldedStream on Sepolia NoxRecipientProxy...`);
  const regTx = await proxy.registerShieldedStream(
    MOCK_SABLIER,
    streamId,
    recipientHandle,
    recipientProof
  );
  const regReceipt = await regTx.wait();
  console.log(`  ✓ registerShieldedStream mined: ${regReceipt.hash}`);

  // 4. Verify on-chain handle public decryptability
  console.log(`\n[4] Verifying isPubliclyDecryptable on NoxCompute contract...`);
  const isPublic = await compute.isPubliclyDecryptable(recipientHandle);
  console.log(`  ✓ Handle Publicly Decryptable: ${isPublic}`);
  if (!isPublic) {
    throw new Error("Handle not marked publicly decryptable!");
  }

  // 5. Request shielded withdrawal on Sepolia
  console.log(`\n[5] Calling requestShieldedWithdraw on Sepolia...`);
  const reqTx = await proxy.requestShieldedWithdraw(MOCK_SABLIER, streamId);
  const reqReceipt = await reqTx.wait();
  const iface = new ethers.Interface(PROXY_ABI);
  let requestId = "";
  for (const log of reqReceipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "ShieldedWithdrawRequested") {
        requestId = parsed.args.requestId;
        break;
      }
    } catch {}
  }
  console.log(`  ✓ requestShieldedWithdraw mined in tx: ${reqReceipt.hash}`);
  console.log(`  ✓ Request ID: ${requestId}`);

  // 6. Fetch gateway decryption proof from real Nox Gateway
  console.log(`\n[6] Fetching decryption proof from Nox TEE Gateway...`);
  const gatewayProof = await fetchDecryptionProof(recipientHandle);
  console.log(`  ✓ Gateway Proof fetched (${(gatewayProof.length - 2) / 2} bytes)`);

  // 7. Decode recipient from gateway proof
  const decodedUint = extractPlaintext(gatewayProof);
  const decodedRecipient = ethers.getAddress(ethers.toBeHex(decodedUint, 20));
  console.log(`  ✓ Decrypted Recipient from Gateway: ${decodedRecipient}`);

  // 8. Fulfill shielded withdrawal on Sepolia
  console.log(`\n[8] Calling fulfillShieldedWithdraw on Sepolia NoxRecipientProxy...`);
  const fulfillTx = await proxy.fulfillShieldedWithdraw(
    requestId,
    decodedRecipient,
    gatewayProof
  );
  const fulfillReceipt = await fulfillTx.wait();
  console.log(`  ✓ fulfillShieldedWithdraw mined in tx: ${fulfillReceipt.hash}`);

  // 9. Confirm withdrawal executed
  const requestState = await proxy.getWithdrawRequest(requestId);
  const remainingWithdrawable = await sablier.withdrawableAmountOf(streamId);
  console.log(`\n[9] Verification Results:`);
  console.log(`  ✓ Request Status: ${requestState.status === 1n ? "Executed (1)" : requestState.status}`);
  console.log(`  ✓ Remaining Sablier Withdrawable: ${remainingWithdrawable}`);

  console.log(`\n🎉 SUCCESS! Real Sepolia end-to-end transaction completed through real Nox Gateway!`);
}

main().catch((err) => {
  console.error("\n❌ Test FAILED:", err);
  process.exit(1);
});
