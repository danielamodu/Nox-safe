// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

/// @title MockNoxCompute
/// @notice Simulates INoxCompute for integration and unit testing on Hardhat network.
contract MockNoxCompute {
    mapping(bytes32 => bool) public publicDecryptionAllowed;

    function validateInputProof(
        bytes32,
        address,
        bytes calldata,
        uint8
    ) external pure returns (bytes32) {
        return bytes32(0);
    }

    function allowPublicDecryption(bytes32 handle) external {
        publicDecryptionAllowed[handle] = true;
    }

    function validateDecryptionProof(
        bytes32,
        bytes calldata proof
    ) external pure returns (bytes memory) {
        require(proof.length > 65, "proof too short");
        return proof[65:];
    }
}
