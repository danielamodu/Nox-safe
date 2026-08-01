// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import "encrypted-types/EncryptedTypes.sol";

/// @dev Minimal interface for Sablier V2 Lockup contracts.
interface ISablierV2LockupMinimal {
    function getSender(uint256 streamId) external view returns (address sender);
    function getRecipient(uint256 streamId) external view returns (address recipient);
    function withdrawableAmountOf(uint256 streamId) external view returns (uint128 withdrawableAmount);
    function withdrawMax(uint256 streamId, address to) external payable returns (uint128 withdrawnAmount);
}

/// @title NoxRecipientProxy
/// @notice Shielded recipient wrapper for Sablier V2 streams.
///         Allows stream creators to set a Nox-encrypted end-recipient address.
///         When a withdrawal is requested, the Nox TEE oracle decrypts the recipient
///         and calls `fulfillShieldedWithdraw` which verifies the gateway proof on-chain
///         and executes Sablier `withdrawMax` directly to the real recipient.
contract NoxRecipientProxy is ReentrancyGuard {
    enum Status { Pending, Executed, Rejected }

    struct ShieldedStream {
        address sablier;
        uint256 streamId;
        bytes32 recipientHandle; // Nox handle for encrypted recipient (address packed as uint256)
        address sender;          // Real stream creator
        bool active;
        bool pendingRequest;     // True while a withdrawal request is in flight
    }

    struct WithdrawRequest {
        address sablier;
        uint256 streamId;
        bytes32 recipientHandle;
        Status status;
        uint256 submittedAt;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public noxOracle;
    address public owner;
    uint256 private _requestNonce;

    // sablier => streamId => ShieldedStream
    mapping(address => mapping(uint256 => ShieldedStream)) private _streams;
    // requestId => WithdrawRequest
    mapping(bytes32 => WithdrawRequest) private _requests;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event StreamShielded(
        address indexed sablier,
        uint256 indexed streamId,
        bytes32 indexed recipientHandle,
        address sender
    );
    event ShieldedWithdrawRequested(
        bytes32 indexed requestId,
        address indexed sablier,
        uint256 indexed streamId,
        bytes32 recipientHandle
    );
    event ShieldedWithdrawExecuted(
        bytes32 indexed requestId,
        address indexed sablier,
        uint256 streamId,
        address indexed recipient,
        uint128 amount
    );
    event ShieldedWithdrawRejected(bytes32 indexed requestId, string reason);
    event NoxOracleUpdated(address indexed previous, address indexed next);
    event OwnershipTransferred(address indexed previous, address indexed next);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOracle();
    error NotOwner();
    error NotStreamSender();
    error ProxyNotRecipient();
    error AlreadyRegistered();
    error StreamNotRegistered();
    error NoWithdrawableAmount();
    error PendingRequestExists(address sablier, uint256 streamId);
    error RequestNotPending(bytes32 requestId);
    error UnknownRequest(bytes32 requestId);
    error InvalidProof(bytes32 requestId);
    error SablierWithdrawFailed(bytes32 requestId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _noxOracle) {
        require(_noxOracle != address(0), "zero noxOracle");
        noxOracle = _noxOracle;
        owner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOracle() {
        if (msg.sender != noxOracle) revert NotOracle();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // -------------------------------------------------------------------------
    // Mutations
    // -------------------------------------------------------------------------

    /// @notice Register a Sablier stream with an encrypted end-recipient address.
    /// @dev Only the real stream sender (sablier.getSender) can call this.
    /// @param sablier          Sablier V2 lockup contract address.
    /// @param streamId         Sablier stream ID (NFT tokenId).
    /// @param recipientHandle  Nox-encrypted recipient address (as externalEuint256).
    /// @param recipientProof   Input proof for recipientHandle from Nox SDK.
    function registerShieldedStream(
        address sablier,
        uint256 streamId,
        externalEuint256 recipientHandle,
        bytes calldata recipientProof
    ) external {
        require(sablier != address(0), "zero sablier");
        require(externalEuint256.unwrap(recipientHandle) != bytes32(0), "zero recipientHandle");

        ISablierV2LockupMinimal lockup = ISablierV2LockupMinimal(sablier);

        // Security check: Proxy must be the recipient in Sablier
        if (lockup.getRecipient(streamId) != address(this)) revert ProxyNotRecipient();

        // Security check: Only the actual stream sender can set the encrypted recipient
        if (lockup.getSender(streamId) != msg.sender) revert NotStreamSender();

        if (_streams[sablier][streamId].active) revert AlreadyRegistered();

        // Register handle on-chain with Nox SDK and authorize public decryption
        euint256 encRecipient = Nox.fromExternal(recipientHandle, recipientProof);
        Nox.allowPublicDecryption(encRecipient);

        bytes32 rawHandle = euint256.unwrap(encRecipient);

        _streams[sablier][streamId] = ShieldedStream({
            sablier: sablier,
            streamId: streamId,
            recipientHandle: rawHandle,
            sender: msg.sender,
            active: true,
            pendingRequest: false
        });

        emit StreamShielded(sablier, streamId, rawHandle, msg.sender);
    }

    /// @notice Submit a withdrawal request for a registered shielded stream.
    /// @param sablier  Sablier V2 lockup contract address.
    /// @param streamId Sablier stream ID.
    /// @return requestId Unique ID for this withdrawal request.
    function requestShieldedWithdraw(
        address sablier,
        uint256 streamId
    ) external returns (bytes32 requestId) {
        ShieldedStream storage stream = _streams[sablier][streamId];
        if (!stream.active) revert StreamNotRegistered();
        if (stream.pendingRequest) revert PendingRequestExists(sablier, streamId);

        ISablierV2LockupMinimal lockup = ISablierV2LockupMinimal(sablier);
        uint128 withdrawable = lockup.withdrawableAmountOf(streamId);
        if (withdrawable == 0) revert NoWithdrawableAmount();

        requestId = keccak256(
            abi.encodePacked(block.chainid, address(this), _requestNonce++, sablier, streamId, msg.sender)
        );

        stream.pendingRequest = true;

        _requests[requestId] = WithdrawRequest({
            sablier: sablier,
            streamId: streamId,
            recipientHandle: stream.recipientHandle,
            status: Status.Pending,
            submittedAt: block.timestamp
        });

        emit ShieldedWithdrawRequested(requestId, sablier, streamId, stream.recipientHandle);
    }

    /// @notice Fulfill a withdrawal request after Nox TEE oracle decryption.
    /// @param requestId       Request ID to fulfill.
    /// @param recipient       Decrypted recipient wallet address.
    /// @param recipientProof Nox gateway decryption proof for recipientHandle.
    function fulfillShieldedWithdraw(
        bytes32 requestId,
        address recipient,
        bytes calldata recipientProof
    ) external onlyOracle nonReentrant {
        WithdrawRequest storage req = _requests[requestId];
        if (req.sablier == address(0)) revert UnknownRequest(requestId);
        if (req.status != Status.Pending) revert RequestNotPending(requestId);

        // Verify gateway decryption proof on-chain
        uint256 decRecipientUint = Nox.publicDecrypt(
            euint256.wrap(req.recipientHandle),
            recipientProof
        );
        if (address(uint160(decRecipientUint)) != recipient) revert InvalidProof(requestId);

        req.status = Status.Executed;
        _streams[req.sablier][req.streamId].pendingRequest = false;

        // Execute withdrawal from Sablier directly to real recipient
        uint128 withdrawn = ISablierV2LockupMinimal(req.sablier).withdrawMax(req.streamId, recipient);

        emit ShieldedWithdrawExecuted(requestId, req.sablier, req.streamId, recipient, withdrawn);
    }

    /// @notice Reject a withdrawal request.
    /// @param requestId Request ID.
    /// @param reason    Reason for rejection.
    function rejectShieldedWithdraw(bytes32 requestId, string calldata reason) external onlyOracle {
        WithdrawRequest storage req = _requests[requestId];
        if (req.sablier == address(0)) revert UnknownRequest(requestId);
        if (req.status != Status.Pending) revert RequestNotPending(requestId);

        req.status = Status.Rejected;
        _streams[req.sablier][req.streamId].pendingRequest = false;
        emit ShieldedWithdrawRejected(requestId, reason);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getShieldedStream(address sablier, uint256 streamId) external view returns (ShieldedStream memory) {
        return _streams[sablier][streamId];
    }

    function getWithdrawRequest(bytes32 requestId) external view returns (WithdrawRequest memory) {
        return _requests[requestId];
    }

    // -------------------------------------------------------------------------
    // Governance
    // -------------------------------------------------------------------------

    function setNoxOracle(address next) external onlyOwner {
        require(next != address(0), "zero oracle");
        emit NoxOracleUpdated(noxOracle, next);
        noxOracle = next;
    }

    function transferOwnership(address next) external onlyOwner {
        require(next != address(0), "zero owner");
        emit OwnershipTransferred(owner, next);
        owner = next;
    }
}
