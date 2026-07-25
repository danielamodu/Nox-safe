// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./interfaces/INoxVerifier.sol";

/// @dev Minimal interface for NoxCompute's decryption proof verification.
interface INoxComputeVerify {
    /// @notice Verifies the gateway's EIP-712 signature over the decryption result.
    /// @param handle          The 32-byte Nox handle.
    /// @param decryptionProof 65-byte ECDSA sig || ABI-encoded plaintext.
    /// @return                The ABI-encoded plaintext; reverts if signature invalid.
    function validateDecryptionProof(
        bytes32 handle,
        bytes calldata decryptionProof
    ) external view returns (bytes memory);
}

/// @title NoxVerifier
/// @notice Verifies Nox gateway decryption proofs for target (address) and
///         value (uint256) handles independently.
///
/// Flow:
///   1. Calls NoxCompute.validateDecryptionProof(targetHandle, targetProof).
///      Returns ABI-encoded uint256 plaintext; reverts if signature invalid.
///   2. Decodes the uint256, casts to address, compares against oracle-claimed target.
///   3. Repeats for valueHandle/valueProof: decodes uint256, compares against value.
///
/// Encoding convention (must match client SDK):
///   - target is encrypted as uint256(uint160(address)) via encryptInput(..., "uint256", ...)
///   - value is encrypted directly as uint256 (wei) via encryptInput(..., "uint256", ...)
///
/// NoxCompute on Ethereum Sepolia: 0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF
contract NoxVerifier is INoxVerifier {
    INoxComputeVerify public immutable noxCompute;

    constructor(address _noxCompute) {
        require(_noxCompute != address(0), "zero noxCompute");
        noxCompute = INoxComputeVerify(_noxCompute);
    }

    /// @inheritdoc INoxVerifier
    function verifyProof(
        bytes32,               // intentId — not used; proof is bound to handle
        bytes32 targetHandle,
        bytes32 valueHandle,
        address target,
        uint256 value,
        bytes calldata targetProof,
        bytes calldata valueProof
    ) external view returns (bool valid) {
        // Verify target: encrypted as uint256(uint160(address)).
        bytes memory targetPlaintext = noxCompute.validateDecryptionProof(targetHandle, targetProof);
        uint256 decodedTargetUint = abi.decode(targetPlaintext, (uint256));
        if (address(uint160(decodedTargetUint)) != target) return false;

        // Verify value: encrypted as uint256 (wei).
        bytes memory valuePlaintext = noxCompute.validateDecryptionProof(valueHandle, valueProof);
        uint256 decodedValue = abi.decode(valuePlaintext, (uint256));
        if (decodedValue != value) return false;

        return true;
    }
}
