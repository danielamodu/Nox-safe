/**
 * Client-side encryption helper — encrypts target and value as separate Nox handles.
 *
 * Usage:
 *   SEPOLIA_RPC_URL=... PRIVATE_KEY=... npx ts-node src/encrypt.ts \
 *     --target 0x1111...1111 \
 *     --value 500000000000000000 \
 *     --module 0xModuleAddress
 *
 * Output:
 *   targetHandle: 0x... (32 bytes — encrypted address as uint256)
 *   valueHandle:  0x... (32 bytes — encrypted wei as uint256)
 *
 * V1 privacy scope:
 *   - target and value are encrypted and fully private for native-ETH transfers.
 *   - calldata (data) is submitted in cleartext — non-empty calldata is a known v2 gap.
 *   Pass both handles to NoxGuardModule.submitIntent(safe, targetHandle, valueHandle, data).
 */

import { ethers } from "ethers";
import { createHandleClient } from "@iexec-nox/handle";

async function main(): Promise<void> {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const key = process.env.PRIVATE_KEY;
  if (!rpc || !key) {
    throw new Error("Missing SEPOLIA_RPC_URL or PRIVATE_KEY env vars");
  }

  const args = process.argv.slice(2);
  const getArg = (name: string): string => {
    const idx = args.indexOf(`--${name}`);
    if (idx === -1 || idx + 1 >= args.length) throw new Error(`Missing --${name}`);
    return args[idx + 1];
  };

  const target = getArg("target");
  const value = BigInt(getArg("value")); // wei as bigint
  const moduleAddr = getArg("module");

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(key, provider);
  const handleClient = await createHandleClient(signer);

  console.log(`Encrypting target: ${target}`);
  console.log(`Encrypting value:  ${value} wei`);

  // Encrypt target address packed as uint256(uint160(address)).
  const { handle: targetHandle } = await handleClient.encryptInput(
    BigInt(target),
    "uint256",
    moduleAddr as `0x${string}`
  );

  // Encrypt ETH value in wei as uint256.
  const { handle: valueHandle } = await handleClient.encryptInput(
    value,
    "uint256",
    moduleAddr as `0x${string}`
  );

  console.log(`\ntargetHandle: ${targetHandle}`);
  console.log(`valueHandle:  ${valueHandle}`);
  console.log(`\nPass to NoxGuardModule.submitIntent(safe, targetHandle, valueHandle, data).`);
  console.log(`For a fully private native-ETH transfer, use data = 0x.`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
