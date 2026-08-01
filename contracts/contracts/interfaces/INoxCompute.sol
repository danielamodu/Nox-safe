// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

/// @notice Minimal interface to the iExec NoxCompute gateway (ACL layer).
interface INoxCompute {
    /// @notice Register a handle on-chain so msg.sender becomes its admin.
    ///         The proof must have been created with applicationContract == msg.sender.
    function validateInputProof(
        bytes32 handle,
        address owner,
        bytes calldata proof,
        uint8 teeType
    ) external;

    /// @notice Allow public (unauthenticated) decryption of a handle.
    ///         Caller must be the handle's admin (set by validateInputProof).
    function allowPublicDecryption(bytes32 handle) external;

    /// @notice Returns true if the handle may be decrypted by anyone.
    function isPubliclyDecryptable(bytes32 handle) external view returns (bool);
}
