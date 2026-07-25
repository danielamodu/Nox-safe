// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.27;

/// @notice Minimal ISafe interface for Safe Module integration.
/// Full spec: https://github.com/safe-global/safe-smart-account
interface ISafe {
    enum Operation {
        Call,
        DelegateCall
    }

    /// @notice Execute a transaction from an enabled module.
    /// @dev Reverts if the module is not enabled or the call fails.
    /// Selector: 0x468721a7
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation
    ) external returns (bool success);

    /// @notice Like execTransactionFromModule but also returns the call's return data.
    /// @dev Use this variant when the called function's return value matters
    ///      (e.g. swap return amounts). Selector: 0x5229073f
    function execTransactionFromModuleReturnData(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation
    ) external returns (bool success, bytes memory returnData);

    /// @notice Returns true if `module` is enabled on this Safe.
    function isModuleEnabled(address module) external view returns (bool);

    /// @notice Returns the list of enabled modules, paginated.
    function getModulesPaginated(
        address start,
        uint256 pageSize
    ) external view returns (address[] memory array, address next);
}
