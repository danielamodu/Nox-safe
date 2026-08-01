import { expect } from "chai";
import { ethers } from "hardhat";
import {
  NoxRecipientProxy,
  MockSablierLockup,
  MockNoxCompute,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NoxRecipientProxy", function () {
  let proxy: NoxRecipientProxy;
  let mockSablier: MockSablierLockup;
  let mockNoxCompute: MockNoxCompute;

  let deployer: SignerWithAddress;
  let oracle: SignerWithAddress;
  let companySender: SignerWithAddress;
  let realRecipient: SignerWithAddress;
  let attacker: SignerWithAddress;

  const STREAM_ID = 101n;
  const WITHDRAWABLE_AMOUNT = ethers.parseEther("500");
  const FAKE_SIG = "0x" + "00".repeat(65);
  const RECIPIENT_HANDLE = ethers.hexlify(ethers.randomBytes(32));
  const INPUT_PROOF = "0x";
  const NOX_COMPUTE_HARDHAT_ADDR = "0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685";

  // Proof generator helper
  function buildRecipientProof(recipientAddr: string): string {
    const plaintext = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256"],
      [BigInt(recipientAddr)]
    );
    return ethers.concat([FAKE_SIG, plaintext]);
  }

  beforeEach(async function () {
    [deployer, oracle, companySender, realRecipient, attacker] = await ethers.getSigners();

    // Deploy MockNoxCompute and set its bytecode at the Hardhat chain address Nox.sol calls
    const mockNoxComputeFactory = await ethers.getContractFactory("MockNoxCompute");
    mockNoxCompute = await mockNoxComputeFactory.deploy();
    const bytecode = await ethers.provider.getCode(await mockNoxCompute.getAddress());
    await ethers.provider.send("hardhat_setCode", [
      NOX_COMPUTE_HARDHAT_ADDR,
      bytecode,
    ]);

    mockSablier = await (await ethers.getContractFactory("MockSablierLockup")).deploy();

    proxy = await (
      await ethers.getContractFactory("NoxRecipientProxy")
    ).deploy(oracle.address);

    // Setup mock stream where recipient is proxy
    await mockSablier.createStream(
      STREAM_ID,
      companySender.address,
      await proxy.getAddress(),
      WITHDRAWABLE_AMOUNT,
      ethers.ZeroAddress
    );
  });

  describe("registerShieldedStream", function () {
    it("allows the stream sender to register an encrypted recipient", async function () {
      const sablierAddr = await mockSablier.getAddress();

      await expect(
        proxy
          .connect(companySender)
          .registerShieldedStream(sablierAddr, STREAM_ID, RECIPIENT_HANDLE, INPUT_PROOF)
      )
        .to.emit(proxy, "StreamShielded")
        .withArgs(sablierAddr, STREAM_ID, RECIPIENT_HANDLE, companySender.address);

      const stream = await proxy.getShieldedStream(sablierAddr, STREAM_ID);
      expect(stream.active).to.be.true;
      expect(stream.sender).to.equal(companySender.address);
      expect(stream.recipientHandle).to.equal(RECIPIENT_HANDLE);
    });

    it("reverts with NotStreamSender if attacker tries to register", async function () {
      const sablierAddr = await mockSablier.getAddress();

      await expect(
        proxy
          .connect(attacker)
          .registerShieldedStream(sablierAddr, STREAM_ID, RECIPIENT_HANDLE, INPUT_PROOF)
      ).to.be.revertedWithCustomError(proxy, "NotStreamSender");
    });

    it("reverts with ProxyNotRecipient if proxy is not recipient in Sablier", async function () {
      const OTHER_STREAM_ID = 202n;
      // Stream created where recipient is attacker, not proxy
      await mockSablier.createStream(
        OTHER_STREAM_ID,
        companySender.address,
        attacker.address,
        WITHDRAWABLE_AMOUNT,
        ethers.ZeroAddress
      );

      const sablierAddr = await mockSablier.getAddress();

      await expect(
        proxy
          .connect(companySender)
          .registerShieldedStream(sablierAddr, OTHER_STREAM_ID, RECIPIENT_HANDLE, INPUT_PROOF)
      ).to.be.revertedWithCustomError(proxy, "ProxyNotRecipient");
    });

    it("reverts if registered twice", async function () {
      const sablierAddr = await mockSablier.getAddress();
      await proxy
        .connect(companySender)
        .registerShieldedStream(sablierAddr, STREAM_ID, RECIPIENT_HANDLE, INPUT_PROOF);

      await expect(
        proxy
          .connect(companySender)
          .registerShieldedStream(sablierAddr, STREAM_ID, RECIPIENT_HANDLE, INPUT_PROOF)
      ).to.be.revertedWithCustomError(proxy, "AlreadyRegistered");
    });
  });

  describe("requestShieldedWithdraw", function () {
    beforeEach(async function () {
      const sablierAddr = await mockSablier.getAddress();
      await proxy
        .connect(companySender)
        .registerShieldedStream(sablierAddr, STREAM_ID, RECIPIENT_HANDLE, INPUT_PROOF);
    });

    it("creates a withdrawal request when stream is registered and withdrawable > 0", async function () {
      const sablierAddr = await mockSablier.getAddress();

      const tx = await proxy.connect(realRecipient).requestShieldedWithdraw(sablierAddr, STREAM_ID);
      const receipt = await tx.wait();

      const event = receipt!.logs
        .map((l) => {
          try {
            return proxy.interface.parseLog(l as any);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "ShieldedWithdrawRequested");

      expect(event).to.not.be.null;
      const requestId = event!.args.requestId;

      const req = await proxy.getWithdrawRequest(requestId);
      expect(req.sablier).to.equal(sablierAddr);
      expect(req.streamId).to.equal(STREAM_ID);
      expect(req.status).to.equal(0); // Pending
    });

    it("reverts if stream is not registered", async function () {
      const UNREGISTERED_STREAM = 999n;
      const sablierAddr = await mockSablier.getAddress();

      await expect(
        proxy.connect(realRecipient).requestShieldedWithdraw(sablierAddr, UNREGISTERED_STREAM)
      ).to.be.revertedWithCustomError(proxy, "StreamNotRegistered");
    });

    it("reverts if withdrawable amount is zero", async function () {
      const sablierAddr = await mockSablier.getAddress();
      await mockSablier.setWithdrawable(STREAM_ID, 0n);

      await expect(
        proxy.connect(realRecipient).requestShieldedWithdraw(sablierAddr, STREAM_ID)
      ).to.be.revertedWithCustomError(proxy, "NoWithdrawableAmount");
    });

    it("reverts if a pending request already exists for this stream", async function () {
      const sablierAddr = await mockSablier.getAddress();

      // First request succeeds
      await proxy.connect(realRecipient).requestShieldedWithdraw(sablierAddr, STREAM_ID);

      // Second request on the same stream while the first is still pending must revert
      await expect(
        proxy.connect(realRecipient).requestShieldedWithdraw(sablierAddr, STREAM_ID)
      ).to.be.revertedWithCustomError(proxy, "PendingRequestExists");
    });
  });

  describe("fulfillShieldedWithdraw", function () {
    let requestId: string;
    let sablierAddr: string;

    beforeEach(async function () {
      sablierAddr = await mockSablier.getAddress();
      await proxy
        .connect(companySender)
        .registerShieldedStream(sablierAddr, STREAM_ID, RECIPIENT_HANDLE, INPUT_PROOF);

      const tx = await proxy.connect(realRecipient).requestShieldedWithdraw(sablierAddr, STREAM_ID);
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => {
          try {
            return proxy.interface.parseLog(l as any);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "ShieldedWithdrawRequested");
      requestId = event!.args.requestId;
    });

    it("fulfills withdrawal directly to real recipient when proof matches", async function () {
      const proof = buildRecipientProof(realRecipient.address);

      await expect(
        proxy
          .connect(oracle)
          .fulfillShieldedWithdraw(requestId, realRecipient.address, proof)
      )
        .to.emit(proxy, "ShieldedWithdrawExecuted")
        .withArgs(requestId, sablierAddr, STREAM_ID, realRecipient.address, WITHDRAWABLE_AMOUNT);

      const req = await proxy.getWithdrawRequest(requestId);
      expect(req.status).to.equal(1); // Executed

      // Confirm Sablier withdrawMax was called
      expect(await mockSablier.withdrawableAmountOf(STREAM_ID)).to.equal(0n);
    });

    it("reverts if non-oracle tries to fulfill", async function () {
      const proof = buildRecipientProof(realRecipient.address);

      await expect(
        proxy
          .connect(attacker)
          .fulfillShieldedWithdraw(requestId, realRecipient.address, proof)
      ).to.be.revertedWithCustomError(proxy, "NotOracle");
    });

    it("reverts InvalidProof if proof plaintext address doesn't match claimed recipient", async function () {
      // Proof encodes realRecipient, but oracle claims attacker address
      const proof = buildRecipientProof(realRecipient.address);

      await expect(
        proxy
          .connect(oracle)
          .fulfillShieldedWithdraw(requestId, attacker.address, proof)
      ).to.be.revertedWithCustomError(proxy, "InvalidProof");
    });
  });

  describe("rejectShieldedWithdraw", function () {
    it("allows oracle to reject a pending request", async function () {
      const sablierAddr = await mockSablier.getAddress();
      await proxy
        .connect(companySender)
        .registerShieldedStream(sablierAddr, STREAM_ID, RECIPIENT_HANDLE, INPUT_PROOF);

      const tx = await proxy.connect(realRecipient).requestShieldedWithdraw(sablierAddr, STREAM_ID);
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => {
          try { return proxy.interface.parseLog(l as any); } catch { return null; }
        })
        .find((e) => e?.name === "ShieldedWithdrawRequested");
      const requestId = event!.args.requestId;

      await expect(
        proxy.connect(oracle).rejectShieldedWithdraw(requestId, "Invalid signature")
      )
        .to.emit(proxy, "ShieldedWithdrawRejected")
        .withArgs(requestId, "Invalid signature");

      const req = await proxy.getWithdrawRequest(requestId);
      expect(req.status).to.equal(2); // Rejected
    });
  });
});
