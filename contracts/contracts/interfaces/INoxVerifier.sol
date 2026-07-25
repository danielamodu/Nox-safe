// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title INoxVerifier
/// @notice Verifies that Nox gateway decryption proofs are authentic and that
///         the decrypted plaintexts match the oracle-provided target and value.
///
/// V1 privacy scope: target (address) and value (ETH amount) are encrypted as
/// separate uint256 Nox handles.  Calldata (bytes data) is submitted in
/// cleartext and integrity-checked via keccak256, NOT privacy-protected.
///
/// Full privacy therefore applies only to native-ETH transfers where data=0x.
/// ERC-20 and any call with meaningful calldata is a known v2 gap: the
/// recipient/amount live inside data and remain visible on-chain.
interface INoxVerifier {
    /// @notice Verify Nox gateway decryption proofs for target and value.
    /// @param intentId     Unique intent ID (for logging / future extensions).
    /// @param targetHandle 32-byte Nox handle for the encrypted target address
    ///                     (address was packed as uint256 before encryption).
    /// @param valueHandle  32-byte Nox handle for the encrypted ETH value (wei).
    /// @param target       Claimed target address from the TEE.
    /// @param value        Claimed ETH value (wei) from the TEE.
    /// @param targetProof  Decryption proof for targetHandle from the Nox gateway
    ///                     (65-byte ECDSA sig || ABI-encoded uint256 plaintext).
    /// @param valueProof   Decryption proof for valueHandle from the Nox gateway.
    /// @return valid       True iff both gateway signatures are valid and the
    ///                     decoded plaintexts match (target, value).
    function verifyProof(
        bytes32 intentId,
        bytes32 targetHandle,
        bytes32 valueHandle,
        address target,
        uint256 value,
        bytes calldata targetProof,
        bytes calldata valueProof
    ) external view returns (bool valid);
}
