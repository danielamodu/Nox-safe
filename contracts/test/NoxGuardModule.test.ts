import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  NoxGuardModule,
  PolicyRegistry,
  MockSafe,
  MockNoxCompute,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NoxGuardModule", function () {
  let module: NoxGuardModule;
  let registry: PolicyRegistry;
  let mockSafe: MockSafe;
  let mockNoxCompute: MockNoxCompute;

  let deployer: SignerWithAddress;
  let oracle: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const TARGET = "0x1111111111111111111111111111111111111111";
  const OTHER_TARGET = "0x2222222222222222222222222222222222222222";
  const MAX_PER_TX = ethers.parseEther("1");
  const MAX_PER_DAY = ethers.parseEther("3");
  const TARGET_HANDLE = ethers.hexlify(ethers.randomBytes(32));
  const VALUE_HANDLE = ethers.hexlify(ethers.randomBytes(32));
  const EMPTY_PROOF = "0x";
  const FAKE_SIG = "0x" + "00".repeat(65);
  const NOX_COMPUTE_HARDHAT_ADDR = "0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685";

  function buildTargetProof(target: string): string {
    const plaintext = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256"],
      [BigInt(target)]
    );
    return ethers.concat([FAKE_SIG, plaintext]);
  }

  function buildValueProof(value: bigint): string {
    const plaintext = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256"],
      [value]
    );
    return ethers.concat([FAKE_SIG, plaintext]);
  }

  async function deployAll() {
    [deployer, oracle, alice, bob] = await ethers.getSigners();

    const mockNoxComputeFactory = await ethers.getContractFactory("MockNoxCompute");
    mockNoxCompute = await mockNoxComputeFactory.deploy();
    const bytecode = await ethers.provider.getCode(await mockNoxCompute.getAddress());
    await ethers.provider.send("hardhat_setCode", [
      NOX_COMPUTE_HARDHAT_ADDR,
      bytecode,
    ]);

    registry = await (await ethers.getContractFactory("PolicyRegistry")).deploy();
    mockSafe = await (await ethers.getContractFactory("MockSafe")).deploy();

    module = await (
      await ethers.getContractFactory("NoxGuardModule")
    ).deploy(
      await registry.getAddress(),
      oracle.address
    );
  }

  async function setActivePolicy(
    targets: string[] = [TARGET],
    maxPerTx = MAX_PER_TX,
    maxPerDay = MAX_PER_DAY
  ) {
    await mockSafe.setPolicy(await registry.getAddress(), {
      whitelistedTargets: targets,
      maxValuePerTx: maxPerTx,
      maxValuePerDay: maxPerDay,
      active: true,
    });
  }

  async function submitAndGetId(opts?: {
    safe?: string;
    targetHandle?: string;
    valueHandle?: string;
    data?: string;
    caller?: SignerWithAddress;
  }): Promise<string> {
    const safeAddr = opts?.safe ?? (await mockSafe.getAddress());
    const th = opts?.targetHandle ?? TARGET_HANDLE;
    const vh = opts?.valueHandle ?? VALUE_HANDLE;
    const data = opts?.data ?? "0x";
    const signer = opts?.caller ?? alice;

    const tx = await module.connect(signer).submitIntent(safeAddr, th, EMPTY_PROOF, vh, EMPTY_PROOF, data);
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => {
        try {
          return module.interface.parseLog(l as any);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "IntentSubmitted");
    return event!.args.intentId;
  }

  beforeEach(deployAll);

  it("sets initial state correctly", async function () {
    expect(await module.noxOracle()).to.equal(oracle.address);
    expect(await module.policyRegistry()).to.equal(await registry.getAddress());
    expect(await module.owner()).to.equal(deployer.address);
  });

  describe("submitIntent", function () {
    it("stores intent and emits IntentSubmitted", async function () {
      const safeAddr = await mockSafe.getAddress();
      const tx = await module.connect(alice).submitIntent(safeAddr, TARGET_HANDLE, EMPTY_PROOF, VALUE_HANDLE, EMPTY_PROOF, "0x");
      const receipt = await tx.wait();

      const event = receipt!.logs
        .map((l) => {
          try { return module.interface.parseLog(l as any); } catch { return null; }
        })
        .find((e) => e?.name === "IntentSubmitted");

      expect(event).to.not.be.null;
      const intentId = event!.args.intentId;
      expect(event!.args.safe).to.equal(safeAddr);

      const intent = await module.getIntent(intentId);
      expect(intent.safe).to.equal(safeAddr);
      expect(intent.status).to.equal(0);
    });
  });

  describe("fulfillIntent", function () {
    beforeEach(async function () {
      await setActivePolicy();
    });

    it("fulfills a valid intent", async function () {
      const safeAddr = await mockSafe.getAddress();
      const callValue = ethers.parseEther("0.5");
      const intentId = await submitAndGetId({ safe: safeAddr });

      const targetProof = buildTargetProof(TARGET);
      const valueProof = buildValueProof(callValue);

      await expect(
        module.connect(oracle).fulfillIntent(intentId, TARGET, callValue, "0x", targetProof, valueProof)
      )
        .to.emit(module, "IntentExecuted")
        .withArgs(intentId, safeAddr, TARGET, callValue, "0x");

      expect(await module.getIntentStatus(intentId)).to.equal(1);
    });

    it("reverts if non-oracle tries to fulfill", async function () {
      const intentId = await submitAndGetId();
      const targetProof = buildTargetProof(TARGET);
      const valueProof = buildValueProof(0n);

      await expect(
        module.connect(alice).fulfillIntent(intentId, TARGET, 0n, "0x", targetProof, valueProof)
      ).to.be.revertedWithCustomError(module, "NotOracle");
    });
  });

  describe("governance", function () {
    it("owner can update noxOracle", async function () {
      await expect(
        module.connect(deployer).setNoxOracle(bob.address)
      )
        .to.emit(module, "NoxOracleUpdated")
        .withArgs(oracle.address, bob.address);
      expect(await module.noxOracle()).to.equal(bob.address);
    });

    it("owner can transfer ownership", async function () {
      await module.connect(deployer).transferOwnership(alice.address);
      expect(await module.owner()).to.equal(alice.address);
    });
  });
});
