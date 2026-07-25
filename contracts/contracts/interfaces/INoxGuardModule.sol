// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import "encrypted-types/EncryptedTypes.sol";

/// @title INoxGuardModule
/// @notice Interface for the Nox-Safe confidential intent execution module.
///
/// Submit flow:
///   1. User encrypts target (address packed as uint256) and value (wei as uint256)
///      via the Nox SDK with applicationContract = this contract's address.
///   2. User calls submitIntent with the resulting externalEuint256 handles and
///      input proofs. The module registers both handles on-chain via
///      Nox.fromExternal (validateInputProof with teeType=Uint256) and marks
///      them publicly decryptable.
///
/// Fulfill flow:
///   3. The Nox TEE oracle fetches decryption proofs from the Nox gateway and
///      calls fulfillIntent with the plaintext target/value + raw gateway proofs.
///   4. fulfillIntent verifies proofs on-chain via Nox.publicDecrypt, re-checks
///      policy, and executes via Safe.execTransactionFromModule.
///
/// Privacy scope:
///   - target (recipient address) — encrypted, fully private.
///   - value (ETH amount in wei) — encrypted, fully private.
///   - data (calldata) — cleartext; integrity-checked via keccak256 only.
///   Full privacy applies to native-ETH transfers (data=0x). ERC-20 transfers
///   with meaningful calldata are a known v2 gap.
interface INoxGuardModule {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum IntentStatus { Pending, Executed, Rejected }

    struct Intent {
        address safe;
        IntentStatus status;
        uint256 submittedAt;
        bytes32 targetHandle;
        bytes32 valueHandle;
        bytes32 dataHash;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event IntentSubmitted(
        bytes32 indexed intentId,
        address indexed safe,
        bytes32 targetHandle,
        bytes32 valueHandle,
        bytes data
    );

    event IntentExecuted(
        bytes32 indexed intentId,
        address indexed safe,
        address target,
        uint256 value,
        bytes data
    );

    event IntentRejected(bytes32 indexed intentId, string reason);

    // -------------------------------------------------------------------------
    // Mutations
    // -------------------------------------------------------------------------

    /// @notice Submit a trade intent for TEE evaluation.
    /// @dev The caller must have encrypted target and value via the Nox SDK with
    ///      applicationContract == address(this).
    /// @param safe         The Safe that should execute if approved.
    /// @param targetHandle Nox-encrypted target address (as externalEuint256).
    /// @param targetProof  Input proof for targetHandle from the Nox SDK.
    /// @param valueHandle  Nox-encrypted ETH value in wei (as externalEuint256).
    /// @param valueProof   Input proof for valueHandle from the Nox SDK.
    /// @param data         Cleartext calldata (empty for native-ETH transfers).
    /// @return intentId    keccak256-based unique ID for this intent.
    function submitIntent(
        address safe,
        externalEuint256 targetHandle,
        bytes calldata targetProof,
        externalEuint256 valueHandle,
        bytes calldata valueProof,
        bytes calldata data
    ) external returns (bytes32 intentId);

    /// @notice Called by the authorised Nox oracle after TEE decryption.
    /// @param intentId   The intent being fulfilled.
    /// @param target     Decrypted target address.
    /// @param value      Decrypted ETH value in wei.
    /// @param data       Cleartext calldata (must match stored dataHash).
    /// @param targetProof Gateway decryption proof for targetHandle.
    /// @param valueProof  Gateway decryption proof for valueHandle.
    function fulfillIntent(
        bytes32 intentId,
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata targetProof,
        bytes calldata valueProof
    ) external;

    /// @notice Called by the oracle to decline an intent.
    function rejectIntent(bytes32 intentId, string calldata reason) external;

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getIntent(bytes32 intentId) external view returns (Intent memory);
    function getIntentStatus(bytes32 intentId) external view returns (IntentStatus);
    function noxOracle() external view returns (address);
}
