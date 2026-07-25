/**
 * Nox TEE Task — Off-chain oracle daemon processing encrypted Safe intents and
 * Sablier shielded recipient withdrawal requests.
 *
 * Safe Intent Lifecycle:
 *  1. Listen for IntentSubmitted events on NoxGuardModule.
 *  2. For each intent, fetch raw decryption proofs from the Nox gateway.
 *  3. Decode target and value from the 32-byte plaintext.
 *  4. Validate against PolicyRegistry off-chain.
 *  5. Call fulfillIntent with plaintext values + raw proofs.
 *
 * Sablier Shielded Recipient Lifecycle:
 *  1. Listen for ShieldedWithdrawRequested events on NoxRecipientProxy.
 *  2. Fetch recipient decryption proof from Nox gateway.
 *  3. Decode recipient address from the 32-byte plaintext.
 *  4. Call fulfillShieldedWithdraw with decoded recipient address + raw proof.
 */

import "dotenv/config";
import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GATEWAY   = "https://gateway-testnets.noxprotocol.dev";
const CHAIN_ID  = 11155111;

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------

const MODULE_ABI = [
  "event IntentSubmitted(bytes32 indexed intentId, address indexed safe, bytes32 targetHandle, bytes32 valueHandle, bytes data)",
  "function getIntent(bytes32 intentId) view returns (tuple(address safe, uint8 status, uint256 submittedAt, bytes32 targetHandle, bytes32 valueHandle, bytes32 dataHash))",
  "function fulfillIntent(bytes32 intentId, address target, uint256 value, bytes data, bytes targetProof, bytes valueProof)",
  "function rejectIntent(bytes32 intentId, string reason)",
];

const PROXY_ABI = [
  "event ShieldedWithdrawRequested(bytes32 indexed requestId, address indexed sablier, uint256 indexed streamId, bytes32 recipientHandle)",
  "function getWithdrawRequest(bytes32 requestId) view returns (tuple(address sablier, uint256 streamId, bytes32 recipientHandle, uint8 status, uint256 submittedAt))",
  "function fulfillShieldedWithdraw(bytes32 requestId, address recipient, bytes recipientProof)",
  "function rejectShieldedWithdraw(bytes32 requestId, string reason)",
];

const REGISTRY_ABI = [
  "function getPolicy(address safe) view returns (tuple(address[] whitelistedTargets, uint256 maxValuePerTx, uint256 maxValuePerDay, bool active))",
  "function isTargetWhitelisted(address safe, address target) view returns (bool)",
];

// ---------------------------------------------------------------------------
// Gateway helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the raw decryption proof from the Nox gateway for a handle.
 * Response: { payload: { decryptionProof: "0x<65-byte-sig><32-byte-plaintext>" }, signature: "0x..." }
 * Returns the full rawProof bytes string.
 */
async function fetchDecryptionProof(handle: string): Promise<string> {
  const url = `${GATEWAY}/v0/public/${handle}?chain_id=${CHAIN_ID}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gateway ${res.status} for handle ${handle}: ${await res.text()}`);
  }
  const json = await res.json() as Record<string, unknown>;
  const rawProof =
    (json.payload as Record<string, unknown>)?.decryptionProof as string ??
    (json as Record<string, unknown>).decryptionProof as string ??
    (json as Record<string, unknown>).proof as string;
  if (!rawProof) throw new Error(`No decryptionProof in gateway response: ${JSON.stringify(json)}`);
  return rawProof.startsWith("0x") ? rawProof : "0x" + rawProof;
}

/**
 * Extract the 32-byte plaintext from a raw proof.
 * Format: 0x + 65-byte sig (130 hex chars) + 32-byte plaintext (64 hex chars).
 */
function extractPlaintext(rawProof: string): bigint {
  const plaintextHex = "0x" + rawProof.slice(2 + 65 * 2);
  return BigInt(plaintextHex);
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

function getConfig() {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const key = process.env.ORACLE_PRIVATE_KEY;
  const moduleAddr = process.env.NOX_GUARD_MODULE;
  const proxyAddr = process.env.NOX_RECIPIENT_PROXY;
  const registryAddr = process.env.POLICY_REGISTRY;

  if (!rpc || !key || !moduleAddr || !registryAddr) {
    throw new Error(
      "Missing env: SEPOLIA_RPC_URL, ORACLE_PRIVATE_KEY, NOX_GUARD_MODULE, POLICY_REGISTRY"
    );
  }

  return { rpc, key, moduleAddr, proxyAddr, registryAddr };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const INTENT_SUBMITTED_TOPIC = ethers.id(
  "IntentSubmitted(bytes32,address,bytes32,bytes32,bytes)"
);
const SHIELDED_WITHDRAW_TOPIC = ethers.id(
  "ShieldedWithdrawRequested(bytes32,address,uint256,bytes32)"
);

const POLL_INTERVAL_MS = 12_000;
const STARTUP_LOOKBACK_BLOCKS = 100;
const MAX_BLOCK_RANGE = 9;

async function main(): Promise<void> {
  const cfg = getConfig();
  const provider = new ethers.JsonRpcProvider(cfg.rpc, undefined, { batchMaxCount: 1 });
  const oracleSigner = new ethers.Wallet(cfg.key, provider);

  const module = new ethers.Contract(cfg.moduleAddr, MODULE_ABI, oracleSigner);
  const registry = new ethers.Contract(cfg.registryAddr, REGISTRY_ABI, provider);
  const proxy = cfg.proxyAddr ? new ethers.Contract(cfg.proxyAddr, PROXY_ABI, oracleSigner) : null;

  console.log(`[nox-task] Oracle address: ${oracleSigner.address}`);
  console.log(`[nox-task] Module:   ${cfg.moduleAddr}`);
  console.log(`[nox-task] Registry: ${cfg.registryAddr}`);
  if (proxy) {
    console.log(`[nox-task] Sablier Proxy: ${cfg.proxyAddr}`);
  }

  const moduleIface = new ethers.Interface(MODULE_ABI);
  const proxyIface = new ethers.Interface(PROXY_ABI);

  async function scanAndProcessModule(fromBlock: number, toBlock: number): Promise<void> {
    const allLogs = [];
    for (let from = fromBlock; from <= toBlock; from += MAX_BLOCK_RANGE + 1) {
      const to = Math.min(from + MAX_BLOCK_RANGE, toBlock);
      const chunk = await provider.getLogs({
        address: cfg.moduleAddr,
        topics: [INTENT_SUBMITTED_TOPIC],
        fromBlock: from,
        toBlock: to,
      });
      allLogs.push(...chunk);
    }
    for (const log of allLogs) {
      const parsed = moduleIface.parseLog(log);
      if (!parsed) continue;
      const [intentId, safe, targetHandle, valueHandle, data] = parsed.args;
      console.log(`\n[nox-task] IntentSubmitted: ${intentId}`);
      try {
        const intent = await module.getIntent(intentId);
        if (intent.status !== 0n) {
          console.log(`[nox-task] Already processed (status=${intent.status}), skipping.`);
          continue;
        }
        await processIntent(module, registry, intentId, safe, targetHandle, valueHandle, data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[nox-task] Error processing intent ${intentId}:`, msg);
      }
    }
  }

  async function scanAndProcessProxy(fromBlock: number, toBlock: number): Promise<void> {
    if (!proxy || !cfg.proxyAddr) return;

    const allLogs = [];
    for (let from = fromBlock; from <= toBlock; from += MAX_BLOCK_RANGE + 1) {
      const to = Math.min(from + MAX_BLOCK_RANGE, toBlock);
      const chunk = await provider.getLogs({
        address: cfg.proxyAddr,
        topics: [SHIELDED_WITHDRAW_TOPIC],
        fromBlock: from,
        toBlock: to,
      });
      allLogs.push(...chunk);
    }
    for (const log of allLogs) {
      const parsed = proxyIface.parseLog(log);
      if (!parsed) continue;
      const [requestId, sablier, streamId, recipientHandle] = parsed.args;
      console.log(`\n[nox-task] ShieldedWithdrawRequested: ${requestId}`);
      console.log(`  sablier:         ${sablier}`);
      console.log(`  streamId:        ${streamId}`);
      console.log(`  recipientHandle: ${recipientHandle}`);
      try {
        const request = await proxy.getWithdrawRequest(requestId);
        if (request.status !== 0n) {
          console.log(`[nox-task] Already processed (status=${request.status}), skipping.`);
          continue;
        }
        await processShieldedWithdraw(proxy, requestId, recipientHandle);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[nox-task] Error processing withdrawal ${requestId}:`, msg);
      }
    }
  }

  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - STARTUP_LOOKBACK_BLOCKS);
  console.log(`[nox-task] Scanning blocks ${fromBlock}–${latestBlock} for missed events...`);
  await scanAndProcessModule(fromBlock, latestBlock);
  await scanAndProcessProxy(fromBlock, latestBlock);

  let lastSeenBlock = latestBlock;
  console.log(`[nox-task] Polling every ${POLL_INTERVAL_MS / 1000}s...`);
  setInterval(async () => {
    try {
      const current = await provider.getBlockNumber();
      if (current <= lastSeenBlock) return;
      await scanAndProcessModule(lastSeenBlock + 1, current);
      await scanAndProcessProxy(lastSeenBlock + 1, current);
      lastSeenBlock = current;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[nox-task] Poll error:`, msg);
    }
  }, POLL_INTERVAL_MS);

  await new Promise(() => {});
}

async function processIntent(
  module: ethers.Contract,
  registry: ethers.Contract,
  intentId: string,
  safe: string,
  targetHandle: string,
  valueHandle: string,
  data: string
): Promise<void> {
  console.log(`[nox-task] Fetching decryption proofs from gateway...`);
  const [targetProof, valueProof] = await Promise.all([
    fetchDecryptionProof(targetHandle),
    fetchDecryptionProof(valueHandle),
  ]);

  const targetUint = extractPlaintext(targetProof);
  const value      = extractPlaintext(valueProof);
  const target     = ethers.getAddress(ethers.toBeHex(targetUint, 20));
  console.log(`[nox-task] Decoded: target=${target} value=${value}`);

  const policy = await registry.getPolicy(safe);

  if (!policy.active) {
    console.log(`[nox-task] Policy inactive — rejecting`);
    const tx = await module.rejectIntent(intentId, "policy inactive");
    await tx.wait();
    return;
  }

  const isWhitelisted = await registry.isTargetWhitelisted(safe, target);
  if (!isWhitelisted) {
    console.log(`[nox-task] Target not whitelisted — rejecting`);
    const tx = await module.rejectIntent(intentId, "target not whitelisted");
    await tx.wait();
    return;
  }

  if (value > policy.maxValuePerTx) {
    console.log(`[nox-task] Value exceeds per-tx cap — rejecting`);
    const tx = await module.rejectIntent(intentId, "value exceeds per-tx cap");
    await tx.wait();
    return;
  }

  console.log(`[nox-task] Fulfilling intent...`);
  try {
    const tx = await module.fulfillIntent(
      intentId,
      target,
      value,
      data,
      targetProof,
      valueProof
    );
    const receipt = await tx.wait();
    console.log(`[nox-task] Intent fulfilled in tx: ${receipt.hash}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nox-task] fulfillIntent reverted: ${msg}`);
  }
}

async function processShieldedWithdraw(
  proxy: ethers.Contract,
  requestId: string,
  recipientHandle: string
): Promise<void> {
  console.log(`[nox-task] Fetching recipient decryption proof from gateway...`);
  const recipientProof = await fetchDecryptionProof(recipientHandle);
  const recipientUint = extractPlaintext(recipientProof);
  const recipient = ethers.getAddress(ethers.toBeHex(recipientUint, 20));
  console.log(`[nox-task] Decoded shielded recipient: ${recipient}`);

  console.log(`[nox-task] Fulfilling shielded withdrawal...`);
  try {
    const tx = await proxy.fulfillShieldedWithdraw(
      requestId,
      recipient,
      recipientProof
    );
    const receipt = await tx.wait();
    console.log(`[nox-task] Shielded withdrawal fulfilled in tx: ${receipt.hash}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nox-task] fulfillShieldedWithdraw reverted: ${msg}`);
  }
}

main().catch((err) => {
  console.error("[nox-task] Fatal:", err);
  process.exit(1);
});
