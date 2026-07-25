import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const EXISTING_POLICY_REGISTRY = "0x1A86ed6a9739Ae24D089FaC892DeC2f09280Cce1";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log(`\nRedeploying NoxGuardModule on ${network.name} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`Reusing PolicyRegistry: ${EXISTING_POLICY_REGISTRY}\n`);

  const ModuleFactory = await ethers.getContractFactory("NoxGuardModule");
  const module = await ModuleFactory.deploy(EXISTING_POLICY_REGISTRY, deployer.address);
  await module.waitForDeployment();
  const moduleAddr = await module.getAddress();
  console.log(`NoxGuardModule: ${moduleAddr}`);

  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for block confirmations before verifying...");
    await module.deploymentTransaction()?.wait(3);
    try {
      await run("verify:verify", {
        address: moduleAddr,
        constructorArguments: [EXISTING_POLICY_REGISTRY, deployer.address],
      });
      console.log("Verified NoxGuardModule on Etherscan");
    } catch (e: any) {
      console.warn(`Verification skipped: ${e.message?.split("\n")[0]}`);
    }
  }

  // Update deployments/sepolia.json
  const outPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  existing.contracts.NoxGuardModule = moduleAddr;
  existing.timestamp = new Date().toISOString();

  const safeIface = new ethers.Interface(["function enableModule(address module)"]);
  existing.safeSetup.step1_enableModule.data = safeIface.encodeFunctionData("enableModule", [moduleAddr]);

  fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
  console.log(`\nUpdated deployments/${network.name}.json`);
  console.log(`\n--- COPY THIS ---`);
  console.log(`NEW NoxGuardModule: ${moduleAddr}`);
  console.log(`-----------------\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
