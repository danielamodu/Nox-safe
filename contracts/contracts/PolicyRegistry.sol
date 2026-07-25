// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./interfaces/IPolicyRegistry.sol";

/// @title PolicyRegistry
/// @notice Stores per-Safe execution policies.
///
/// Access model: any address can call setPolicy, and the policy is stored
/// against msg.sender. In production, the Safe itself is always msg.sender
/// because setPolicy is called via a signed multisig transaction (where the
/// Safe is the tx origin). This means:
///   - No attacker can write to a Safe's slot (they'd write their own slot).
///   - No extra access-control logic is required.
contract PolicyRegistry is IPolicyRegistry {
    mapping(address => Policy) private _policies;

    function setPolicy(Policy calldata policy) external {
        // msg.sender is the Safe in production (called via multisig tx).
        // Deep-copy dynamic array into storage.
        delete _policies[msg.sender].whitelistedTargets;

        Policy storage stored = _policies[msg.sender];
        uint256 len = policy.whitelistedTargets.length;
        for (uint256 i = 0; i < len; i++) {
            stored.whitelistedTargets.push(policy.whitelistedTargets[i]);
        }
        stored.maxValuePerTx = policy.maxValuePerTx;
        stored.maxValuePerDay = policy.maxValuePerDay;
        stored.active = policy.active;

        emit PolicyUpdated(msg.sender);
    }

    function getPolicy(address safe) external view returns (Policy memory) {
        return _policies[safe];
    }

    function isTargetWhitelisted(
        address safe,
        address target
    ) external view returns (bool) {
        address[] storage targets = _policies[safe].whitelistedTargets;
        uint256 len = targets.length;
        for (uint256 i = 0; i < len; i++) {
            if (targets[i] == target) return true;
        }
        return false;
    }
}
