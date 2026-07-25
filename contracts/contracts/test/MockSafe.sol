// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "../interfaces/ISafe.sol";
import "../interfaces/IPolicyRegistry.sol";

/// @dev Test helper — controllable Safe mock.
contract MockSafe is ISafe {
    bool public shouldSucceed = true;

    function setExecResult(bool result) external {
        shouldSucceed = result;
    }

    function execTransactionFromModule(
        address, uint256, bytes calldata, Operation
    ) external view returns (bool) {
        return shouldSucceed;
    }

    function execTransactionFromModuleReturnData(
        address, uint256, bytes calldata, Operation
    ) external view returns (bool success, bytes memory returnData) {
        return (shouldSucceed, "");
    }

    function isModuleEnabled(address) external pure returns (bool) {
        return true;
    }

    function getModulesPaginated(
        address, uint256
    ) external pure returns (address[] memory array, address next) {
        return (new address[](0), address(0));
    }

    /// @dev Call PolicyRegistry.setPolicy as this contract (simulating a Safe multisig tx).
    function setPolicy(
        IPolicyRegistry registry,
        IPolicyRegistry.Policy calldata policy
    ) external {
        registry.setPolicy(policy);
    }

    receive() external payable {}
}
