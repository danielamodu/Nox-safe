import { expect } from "chai";
import { ethers } from "hardhat";
import { PolicyRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PolicyRegistry", function () {
  let registry: PolicyRegistry;
  let safe: SignerWithAddress;   // acts as the Safe (msg.sender = safe address)
  let attacker: SignerWithAddress;
  let other: SignerWithAddress;

  const TARGET_A = "0x1111111111111111111111111111111111111111";
  const TARGET_B = "0x2222222222222222222222222222222222222222";

  const basePolicy = {
    whitelistedTargets: [TARGET_A, TARGET_B],
    maxValuePerTx: ethers.parseEther("1"),
    maxValuePerDay: ethers.parseEther("5"),
    active: true,
  };

  beforeEach(async function () {
    [, safe, attacker, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PolicyRegistry");
    registry = await factory.deploy();
  });

  // ---------------------------------------------------------------------------
  // setPolicy
  // ---------------------------------------------------------------------------

  it("stores a policy for msg.sender", async function () {
    await registry.connect(safe).setPolicy(basePolicy);
    const stored = await registry.getPolicy(safe.address);

    expect(stored.active).to.be.true;
    expect(stored.maxValuePerTx).to.equal(basePolicy.maxValuePerTx);
    expect(stored.maxValuePerDay).to.equal(basePolicy.maxValuePerDay);
    expect(stored.whitelistedTargets).to.deep.equal(basePolicy.whitelistedTargets);
  });

  it("emits PolicyUpdated with the Safe address", async function () {
    await expect(registry.connect(safe).setPolicy(basePolicy))
      .to.emit(registry, "PolicyUpdated")
      .withArgs(safe.address);
  });

  it("overwrites an existing policy", async function () {
    await registry.connect(safe).setPolicy(basePolicy);

    const updatedPolicy = {
      whitelistedTargets: [TARGET_A],
      maxValuePerTx: ethers.parseEther("0.5"),
      maxValuePerDay: ethers.parseEther("2"),
      active: true,
    };
    await registry.connect(safe).setPolicy(updatedPolicy);

    const stored = await registry.getPolicy(safe.address);
    expect(stored.maxValuePerTx).to.equal(updatedPolicy.maxValuePerTx);
    expect(stored.whitelistedTargets.length).to.equal(1);
    expect(stored.whitelistedTargets[0]).to.equal(TARGET_A);
  });

  it("can deactivate a policy by setting active=false", async function () {
    await registry.connect(safe).setPolicy(basePolicy);
    await registry.connect(safe).setPolicy({ ...basePolicy, active: false });
    const stored = await registry.getPolicy(safe.address);
    expect(stored.active).to.be.false;
  });

  it("can set a policy with an empty whitelist (effectively blocks all targets)", async function () {
    await registry.connect(safe).setPolicy({ ...basePolicy, whitelistedTargets: [] });
    const stored = await registry.getPolicy(safe.address);
    expect(stored.whitelistedTargets.length).to.equal(0);
  });

  // ---------------------------------------------------------------------------
  // Access-model invariant: attacker cannot affect another address's policy
  // ---------------------------------------------------------------------------

  it("attacker cannot overwrite the Safe's policy slot", async function () {
    await registry.connect(safe).setPolicy(basePolicy);

    // Attacker calls setPolicy — it writes to attacker's slot, not safe's slot.
    const badPolicy = {
      whitelistedTargets: [],
      maxValuePerTx: 0n,
      maxValuePerDay: 0n,
      active: false,
    };
    await registry.connect(attacker).setPolicy(badPolicy);

    // Safe's policy is unchanged.
    const safePolicy = await registry.getPolicy(safe.address);
    expect(safePolicy.active).to.be.true;
    expect(safePolicy.maxValuePerTx).to.equal(basePolicy.maxValuePerTx);

    // Attacker's policy is in attacker's slot.
    const attackerPolicy = await registry.getPolicy(attacker.address);
    expect(attackerPolicy.active).to.be.false;
  });

  it("unset Safe returns inactive empty policy", async function () {
    const stored = await registry.getPolicy(other.address);
    expect(stored.active).to.be.false;
    expect(stored.whitelistedTargets.length).to.equal(0);
    expect(stored.maxValuePerTx).to.equal(0n);
    expect(stored.maxValuePerDay).to.equal(0n);
  });

  // ---------------------------------------------------------------------------
  // getPolicy / isTargetWhitelisted
  // ---------------------------------------------------------------------------

  it("isTargetWhitelisted returns true for whitelisted target", async function () {
    await registry.connect(safe).setPolicy(basePolicy);
    expect(await registry.isTargetWhitelisted(safe.address, TARGET_A)).to.be.true;
    expect(await registry.isTargetWhitelisted(safe.address, TARGET_B)).to.be.true;
  });

  it("isTargetWhitelisted returns false for non-whitelisted target", async function () {
    await registry.connect(safe).setPolicy(basePolicy);
    const unknown = "0x3333333333333333333333333333333333333333";
    expect(await registry.isTargetWhitelisted(safe.address, unknown)).to.be.false;
  });

  it("isTargetWhitelisted returns false after target is removed via policy update", async function () {
    await registry.connect(safe).setPolicy(basePolicy);
    await registry.connect(safe).setPolicy({ ...basePolicy, whitelistedTargets: [TARGET_A] });
    expect(await registry.isTargetWhitelisted(safe.address, TARGET_B)).to.be.false;
    expect(await registry.isTargetWhitelisted(safe.address, TARGET_A)).to.be.true;
  });

  it("isTargetWhitelisted returns false for address with no policy set", async function () {
    expect(await registry.isTargetWhitelisted(other.address, TARGET_A)).to.be.false;
  });
});
