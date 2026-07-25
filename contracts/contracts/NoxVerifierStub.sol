// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./interfaces/INoxVerifier.sol";

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
