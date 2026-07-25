import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log(`\nDeploying on ${network.name} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ------------------------------------------------------------------
  // 1. PolicyRegistry
  // ------------------------------------------------------------------
  const RegistryFactory = await ethers.getContractFactory("PolicyRegistry");
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`PolicyRegistry:     ${registryAddr}`);

  // ------------------------------------------------------------------
  // 2. NoxGuardModule
  // ------------------------------------------------------------------
  const ModuleFactory = await ethers.getContractFactory("NoxGuardModule");
  const module = await ModuleFactory.deploy(registryAddr, deployer.address);
  await module.waitForDeployment();
  const moduleAddr = await module.getAddress();
  console.log(`NoxGuardModule:     ${moduleAddr}`);

  // ------------------------------------------------------------------
  // 3. NoxRecipientProxy (Nox-Sablier Shielded Recipient Wrapper)
  // ------------------------------------------------------------------
  const ProxyFactory = await ethers.getContractFactory("NoxRecipientProxy");
  const proxy = await ProxyFactory.deploy(deployer.address);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log(`NoxRecipientProxy:  ${proxyAddr}`);

  // ------------------------------------------------------------------
  // 4. MockSafe & MockSablier (test helpers for local/test environments)
  // ------------------------------------------------------------------
  const MockSafeFactory = await ethers.getContractFactory("MockSafe");
  const mockSafe = await MockSafeFactory.deploy();
  await mockSafe.waitForDeployment();
  const mockSafeAddr = await mockSafe.getAddress();
  console.log(`MockSafe:           ${mockSafeAddr}`);

  const MockSablierFactory = await ethers.getContractFactory("MockSablierLockup");
  const mockSablier = await MockSablierFactory.deploy();
  await mockSablier.waitForDeployment();
  const mockSablierAddr = await mockSablier.getAddress();
  console.log(`MockSablierLockup:  ${mockSablierAddr}`);

  // ------------------------------------------------------------------
  // 5. Encode enableModule calldata for Safe setup
  // ------------------------------------------------------------------
  const safeIface = new ethers.Interface([
    "function enableModule(address module)",
  ]);
  const enableModuleCalldata = safeIface.encodeFunctionData("enableModule", [moduleAddr]);

  // ------------------------------------------------------------------
  // 6. Etherscan verification (non-fatal if it fails)
  // ------------------------------------------------------------------
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for block confirmations before verifying...");
    await registry.deploymentTransaction()?.wait(3);
    await module.deploymentTransaction()?.wait(3);
    await proxy.deploymentTransaction()?.wait(3);

    for (const [name, addr, args] of [
      ["PolicyRegistry",    registryAddr, []],
      ["NoxGuardModule",    moduleAddr, [registryAddr, deployer.address]],
      ["NoxRecipientProxy", proxyAddr, [deployer.address]],
      ["MockSafe",          mockSafeAddr, []],
      ["MockSablierLockup", mockSablierAddr, []],
    ] as const) {
      try {
        await run("verify:verify", { address: addr, constructorArguments: args });
        console.log(`Verified ${name}`);
      } catch (e: any) {
        console.warn(`Verification skipped for ${name}: ${e.message?.split("\n")[0]}`);
      }
    }
  }

  // ------------------------------------------------------------------
  // 7. Write deployments file
  // ------------------------------------------------------------------
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const deployment = {
    network: network.name,
    chainId: Number(chainId),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PolicyRegistry:     registryAddr,
      NoxGuardModule:     moduleAddr,
      NoxRecipientProxy:  proxyAddr,
      MockSafe:           mockSafeAddr,
      MockSablierLockup:  mockSablierAddr,
      SablierV2SepoliaLinear: "0xAFb979d9afAd1aD27C5eFf4E27226E3AB9e5dCC9",
    },
    noxCompute: "0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF",
    safeSetup: {
      step1_enableModule: {
        data: enableModuleCalldata,
      },
    },
  };

  const outPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to deployments/${network.name}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
