// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// ARCHIVED — testing stub, never deployed to any live network.
// Used during local development before Nox.publicDecrypt was integrated into
// NoxGuardModule. The deployed contract uses Nox.publicDecrypt() directly,
// which performs on-chain proof verification via NoxCompute.

import "../interfaces/INoxVerifier.sol";

/// @title NoxVerifierStub
/// @notice TESTING ONLY — always returns true.
/// The real NoxVerifier calls NoxCompute.validateDecryptionProof and verifies
/// each of the two proofs (targetHandle → address, valueHandle → uint256).
contract NoxVerifierStub is INoxVerifier {
    function verifyProof(
        bytes32,        // intentId
        bytes32,        // targetHandle
        bytes32,        // valueHandle
        address,        // target
        uint256,        // value
        bytes calldata, // targetProof
        bytes calldata  // valueProof
    ) external pure returns (bool) {
        return true;
    }
}
