/**
 * Targeted redeployment of NoxRecipientProxy only.
 * Preserves all existing addresses in deployments/sepolia.json.
 * Run: npx hardhat run scripts/deploy-proxy.ts --network sepolia
 */
import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log(`\nDeploying NoxRecipientProxy on ${network.name} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const ProxyFactory = await ethers.getContractFactory("NoxRecipientProxy");
  const proxy = await ProxyFactory.deploy(deployer.address);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log(`NoxRecipientProxy: ${proxyAddr}`);

  // Etherscan verification
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting 3 confirmations before verifying...");
    await proxy.deploymentTransaction()?.wait(3);
    try {
      await run("verify:verify", {
        address: proxyAddr,
        constructorArguments: [deployer.address],
      });
      console.log("Verified NoxRecipientProxy on Etherscan");
    } catch (e: any) {
      console.warn(`Verification skipped: ${e.message?.split("\n")[0]}`);
    }
  }

  // Patch deployments/sepolia.json — only update NoxRecipientProxy
  const outPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  existing.contracts.NoxRecipientProxy = proxyAddr;
  existing.timestamp = new Date().toISOString();
  fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
  console.log(`\nUpdated deployments/${network.name}.json`);
  console.log(`New NoxRecipientProxy: ${proxyAddr}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
