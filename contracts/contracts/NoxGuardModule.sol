// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import "encrypted-types/EncryptedTypes.sol";
import "./interfaces/INoxGuardModule.sol";
import "./interfaces/IPolicyRegistry.sol";
import "./interfaces/ISafe.sol";

/// @title NoxGuardModule
/// @notice Safe Module that executes trade intents validated by the Nox TEE oracle.
///
/// Submit flow:
///   1. User encrypts target (address as uint256) and value (wei) via the Nox SDK
///      with applicationContract = address(this).
///   2. User calls submitIntent, passing the externalEuint256 handles + input proofs.
///   3. submitIntent calls Nox.fromExternal to register each handle on-chain
///      (validateInputProof with teeType=Uint256 internally) and then marks
///      them as publicly decryptable.
///
/// Fulfill flow:
///   4. The Nox TEE oracle calls the Nox gateway to get a decryption proof for
///      each handle, decodes the plaintext target and value, and calls fulfillIntent.
///   5. fulfillIntent verifies the decryption proofs on-chain via Nox.publicDecrypt,
///      re-checks the PolicyRegistry, and executes via Safe.execTransactionFromModule.
contract NoxGuardModule is INoxGuardModule, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IPolicyRegistry public immutable policyRegistry;

    address public noxOracle;
    address public owner;

    mapping(bytes32 => Intent) private _intents;
    uint256 private _intentNonce;

    // safe => UTC day (block.timestamp / 86400) => cumulative ETH sent (wei)
    mapping(address => mapping(uint256 => uint256)) private _dailySpend;

    // -------------------------------------------------------------------------
    // Events (governance)
    // -------------------------------------------------------------------------

    event NoxOracleUpdated(address indexed previous, address indexed next);
    event OwnershipTransferred(address indexed previous, address indexed next);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOracle();
    error NotOwner();
    error IntentNotPending(bytes32 intentId);
    error UnknownIntent(bytes32 intentId);
    error InvalidProof(bytes32 intentId);
    error DataHashMismatch(bytes32 intentId);
    error SafeExecutionFailed(bytes32 intentId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _policyRegistry, address _noxOracle) {
        require(_policyRegistry != address(0), "zero policyRegistry");
        require(_noxOracle != address(0), "zero noxOracle");

        policyRegistry = IPolicyRegistry(_policyRegistry);
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
    // INoxGuardModule — mutations
    // -------------------------------------------------------------------------

    /// @inheritdoc INoxGuardModule
    function submitIntent(
        address safe,
        externalEuint256 targetHandle,
        bytes calldata targetProof,
        externalEuint256 valueHandle,
        bytes calldata valueProof,
        bytes calldata data
    ) external returns (bytes32 intentId) {
        require(safe != address(0), "zero safe");
        require(externalEuint256.unwrap(targetHandle) != bytes32(0), "zero targetHandle");
        require(externalEuint256.unwrap(valueHandle) != bytes32(0), "zero valueHandle");

        // Register each handle on-chain: validates the user's input proof
        // (teeType=Uint256 internally), making this contract the handle admin.
        // Then mark publicly decryptable so the oracle can decrypt via gateway.
        euint256 encTarget = Nox.fromExternal(targetHandle, targetProof);
        Nox.allowPublicDecryption(encTarget);

        euint256 encValue = Nox.fromExternal(valueHandle, valueProof);
        Nox.allowPublicDecryption(encValue);

        intentId = keccak256(
            abi.encodePacked(block.chainid, address(this), _intentNonce++, safe, msg.sender)
        );

        bytes32 rawTarget = euint256.unwrap(encTarget);
        bytes32 rawValue  = euint256.unwrap(encValue);

        _intents[intentId] = Intent({
            safe:         safe,
            status:       IntentStatus.Pending,
            submittedAt:  block.timestamp,
            targetHandle: rawTarget,
            valueHandle:  rawValue,
            dataHash:     keccak256(data)
        });

        emit IntentSubmitted(intentId, safe, rawTarget, rawValue, data);
    }

    /// @inheritdoc INoxGuardModule
    function fulfillIntent(
        bytes32 intentId,
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata targetProof,
        bytes calldata valueProof
    ) external onlyOracle nonReentrant {
        Intent storage intent = _intents[intentId];

        if (intent.safe == address(0)) revert UnknownIntent(intentId);
        if (intent.status != IntentStatus.Pending) revert IntentNotPending(intentId);

        // 1. Cleartext data integrity: oracle cannot substitute calldata.
        if (keccak256(data) != intent.dataHash) revert DataHashMismatch(intentId);

        // 2. On-chain decryption proof verification via Nox gateway signature.
        //    Reverts if proof is invalid; returns uint256 plaintext if valid.
        uint256 decTargetUint = Nox.publicDecrypt(euint256.wrap(intent.targetHandle), targetProof);
        if (address(uint160(decTargetUint)) != target) revert InvalidProof(intentId);

        uint256 decValue = Nox.publicDecrypt(euint256.wrap(intent.valueHandle), valueProof);
        if (decValue != value) revert InvalidProof(intentId);

        address safe = intent.safe;
        IPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(safe);

        // 3. On-chain policy re-check (guards against policy changes since submission).
        if (!policy.active) {
            _softReject(intent, intentId, "policy inactive");
            return;
        }

        if (!policyRegistry.isTargetWhitelisted(safe, target)) {
            _softReject(intent, intentId, "target not whitelisted");
            return;
        }

        if (value > policy.maxValuePerTx) {
            _softReject(intent, intentId, "value exceeds per-tx cap");
            return;
        }

        uint256 today = block.timestamp / 86400;
        uint256 newDailyTotal = _dailySpend[safe][today] + value;
        if (newDailyTotal > policy.maxValuePerDay) {
            _softReject(intent, intentId, "value exceeds daily cap");
            return;
        }

        // 4. Effects before external call (checks-effects-interactions).
        intent.status = IntentStatus.Executed;
        _dailySpend[safe][today] = newDailyTotal;

        // 5. Execute on Safe.
        bool success = ISafe(safe).execTransactionFromModule(
            target,
            value,
            data,
            ISafe.Operation.Call
        );
        if (!success) revert SafeExecutionFailed(intentId);

        emit IntentExecuted(intentId, safe, target, value, data);
    }

    /// @inheritdoc INoxGuardModule
    function rejectIntent(bytes32 intentId, string calldata reason) external onlyOracle {
        Intent storage intent = _intents[intentId];
        if (intent.safe == address(0)) revert UnknownIntent(intentId);
        if (intent.status != IntentStatus.Pending) revert IntentNotPending(intentId);

        intent.status = IntentStatus.Rejected;
        emit IntentRejected(intentId, reason);
    }

    // -------------------------------------------------------------------------
    // INoxGuardModule — views
    // -------------------------------------------------------------------------

    /// @inheritdoc INoxGuardModule
    function getIntent(bytes32 intentId) external view returns (Intent memory) {
        return _intents[intentId];
    }

    /// @inheritdoc INoxGuardModule
    function getIntentStatus(bytes32 intentId) external view returns (IntentStatus) {
        return _intents[intentId].status;
    }

    /// @notice Cumulative ETH sent for a Safe on a given UTC day.
    function dailySpend(address safe, uint256 utcDay) external view returns (uint256) {
        return _dailySpend[safe][utcDay];
    }

    // -------------------------------------------------------------------------
    // Governance (owner only)
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

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _softReject(
        Intent storage intent,
        bytes32 intentId,
        string memory reason
    ) internal {
        intent.status = IntentStatus.Rejected;
        emit IntentRejected(intentId, reason);
    }
}
