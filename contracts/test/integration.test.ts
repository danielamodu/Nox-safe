import { expect } from "chai";
import { ethers } from "hardhat";
import {
  NoxGuardModule,
  PolicyRegistry,
  MockSafe,
  MockNoxCompute,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Integration test: end-to-end intent lifecycle through NoxGuardModule.
 *
 * Uses MockNoxCompute which strips the 65-byte signature prefix from the proof
 * and returns the remainder as plaintext — same interface as the real NoxCompute
 * without needing a live Nox gateway.
 *
 * Proof format (must match what the Nox SDK produces for uint256 types):
 *   65 zero bytes (fake gateway signature) || abi.encode(uint256)
 *
 * - buildTargetProof(address): encodes address as uint256(uint160(addr))
 * - buildValueProof(bigint):   encodes wei amount as uint256
 */
describe("Integration: NoxGuardModule end-to-end", function () {
  let module: NoxGuardModule;
  let registry: PolicyRegistry;
  let mockSafe: MockSafe;
  let mockNoxCompute: MockNoxCompute;

  let deployer: SignerWithAddress;
  let oracle: SignerWithAddress;
  let alice: SignerWithAddress;

  const TARGET = "0x1111111111111111111111111111111111111111";
  const MAX_PER_TX = ethers.parseEther("1");
  const MAX_PER_DAY = ethers.parseEther("3");
  const FAKE_SIG = "0x" + "00".repeat(65);

  before(async function () {
    [deployer, oracle, alice] = await ethers.getSigners();

    mockNoxCompute = await (
      await ethers.getContractFactory("MockNoxCompute")
    ).deploy();

    const bytecode = await ethers.provider.getCode(await mockNoxCompute.getAddress());
    await ethers.provider.send("hardhat_setCode", [
      "0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685",
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

    await mockSafe.setPolicy(await registry.getAddress(), {
      whitelistedTargets: [TARGET],
      maxValuePerTx: MAX_PER_TX,
      maxValuePerDay: MAX_PER_DAY,
      active: true,
    });
  });

  // Proof for target: address packed as uint256(uint160(address)).
  function buildTargetProof(target: string): string {
    const plaintext = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256"],
      [BigInt(target)]
    );
    return ethers.concat([FAKE_SIG, plaintext]);
  }

  // Proof for value: ETH amount in wei as uint256.
  function buildValueProof(value: bigint): string {
    const plaintext = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256"],
      [value]
    );
    return ethers.concat([FAKE_SIG, plaintext]);
  }

  // Helper to submit and extract intentId from the event.
  async function submit(
    safe: string,
    targetHandle: string,
    valueHandle: string,
    data: string
  ): Promise<string> {
    const tx = await module.connect(alice).submitIntent(safe, targetHandle, "0x", valueHandle, "0x", data);
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => {
        try { return module.interface.parseLog(l as any); } catch { return null; }
      })
      .find((e) => e?.name === "IntentSubmitted");
    return event!.args.intentId;
  }

  it("fulfills a native-ETH intent end-to-end through NoxGuardModule", async function () {
    const safeAddr = await mockSafe.getAddress();
    const callValue = ethers.parseEther("0.5");
    const callData = "0x"; // native ETH — full privacy case

    const targetHandle = ethers.hexlify(ethers.randomBytes(32));
    const valueHandle = ethers.hexlify(ethers.randomBytes(32));

    const intentId = await submit(safeAddr, targetHandle, valueHandle, callData);

    const targetProof = buildTargetProof(TARGET);
    const valueProof = buildValueProof(callValue);

    await expect(
      module.connect(oracle).fulfillIntent(intentId, TARGET, callValue, callData, targetProof, valueProof)
    )
      .to.emit(module, "IntentExecuted")
      .withArgs(intentId, safeAddr, TARGET, callValue, callData);

    expect(await module.getIntentStatus(intentId)).to.equal(1); // Executed
  });

  it("fulfills with non-empty calldata (dataHash integrity check passes)", async function () {
    const safeAddr = await mockSafe.getAddress();
    const callValue = 0n;
    const callData = "0xdeadbeef";

    const targetHandle = ethers.hexlify(ethers.randomBytes(32));
    const valueHandle = ethers.hexlify(ethers.randomBytes(32));

    const intentId = await submit(safeAddr, targetHandle, valueHandle, callData);

    const targetProof = buildTargetProof(TARGET);
    const valueProof = buildValueProof(callValue);

    await expect(
      module.connect(oracle).fulfillIntent(intentId, TARGET, callValue, callData, targetProof, valueProof)
    ).to.emit(module, "IntentExecuted");
  });

  it("reverts DataHashMismatch when oracle swaps the cleartext calldata", async function () {
    const safeAddr = await mockSafe.getAddress();
    const targetHandle = ethers.hexlify(ethers.randomBytes(32));
    const valueHandle = ethers.hexlify(ethers.randomBytes(32));

    // Submitted with "0xdeadbeef" but oracle tries to fulfill with "0x".
    const intentId = await submit(safeAddr, targetHandle, valueHandle, "0xdeadbeef");

    const targetProof = buildTargetProof(TARGET);
    const valueProof = buildValueProof(0n);

    await expect(
      module.connect(oracle).fulfillIntent(intentId, TARGET, 0n, "0x", targetProof, valueProof)
    ).to.be.revertedWithCustomError(module, "DataHashMismatch");
  });

  it("reverts InvalidProof when target proof plaintext doesn't match oracle-claimed address", async function () {
    const safeAddr = await mockSafe.getAddress();
    const targetHandle = ethers.hexlify(ethers.randomBytes(32));
    const valueHandle = ethers.hexlify(ethers.randomBytes(32));

    const intentId = await submit(safeAddr, targetHandle, valueHandle, "0x");

    // Proof encodes TARGET but oracle claims OTHER_TARGET.
    const targetProof = buildTargetProof(TARGET);
    const valueProof = buildValueProof(0n);

    await expect(
      module.connect(oracle).fulfillIntent(
        intentId,
        "0x2222222222222222222222222222222222222222", // mismatch
        0n,
        "0x",
        targetProof,
        valueProof
      )
    ).to.be.revertedWithCustomError(module, "InvalidProof");
  });

  it("reverts InvalidProof when value proof plaintext doesn't match oracle-claimed value", async function () {
    const safeAddr = await mockSafe.getAddress();
    const targetHandle = ethers.hexlify(ethers.randomBytes(32));
    const valueHandle = ethers.hexlify(ethers.randomBytes(32));

    const intentId = await submit(safeAddr, targetHandle, valueHandle, "0x");

    // Proof encodes 0 ETH but oracle claims 1 ETH.
    const targetProof = buildTargetProof(TARGET);
    const valueProof = buildValueProof(0n); // proof says 0

    await expect(
      module.connect(oracle).fulfillIntent(
        intentId,
        TARGET,
        ethers.parseEther("1"), // oracle claims 1 ETH — mismatch
        "0x",
        targetProof,
        valueProof
      )
    ).to.be.revertedWithCustomError(module, "InvalidProof");
  });

  it("soft-rejects when policy changed to inactive after submission", async function () {
    const freshSafe = await (await ethers.getContractFactory("MockSafe")).deploy();
    const targetHandle = ethers.hexlify(ethers.randomBytes(32));
    const valueHandle = ethers.hexlify(ethers.randomBytes(32));

    const intentId = await submit(await freshSafe.getAddress(), targetHandle, valueHandle, "0x");

    const targetProof = buildTargetProof(TARGET);
    const valueProof = buildValueProof(0n);

    // No policy set on freshSafe → soft reject.
    await expect(
      module.connect(oracle).fulfillIntent(intentId, TARGET, 0n, "0x", targetProof, valueProof)
    )
      .to.emit(module, "IntentRejected")
      .withArgs(intentId, "policy inactive");
  });

  it("stores both handles in intent struct and oracle can reject", async function () {
    const safeAddr = await mockSafe.getAddress();
    const targetHandle = ethers.hexlify(ethers.randomBytes(32));
    const valueHandle = ethers.hexlify(ethers.randomBytes(32));

    const intentId = await submit(safeAddr, targetHandle, valueHandle, "0x");

    const intent = await module.getIntent(intentId);
    expect(intent.targetHandle).to.equal(targetHandle);
    expect(intent.valueHandle).to.equal(valueHandle);
    expect(intent.dataHash).to.equal(ethers.keccak256("0x"));

    await module.connect(oracle).rejectIntent(intentId, "TEE declined");
    expect(await module.getIntentStatus(intentId)).to.equal(2); // Rejected
  });
});
