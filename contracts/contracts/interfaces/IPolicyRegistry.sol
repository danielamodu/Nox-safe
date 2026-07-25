// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IPolicyRegistry
/// @notice Interface for the Nox-Safe policy store.
///
/// A Safe's owners approve a Policy once via a normal multisig tx.
/// From that point, the NoxGuardModule validates encrypted intents
/// against the stored policy without requiring per-trade owner signatures.
interface IPolicyRegistry {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Trade policy for a single Safe.
    /// @param whitelistedTargets Addresses the Safe is allowed to call.
    /// @param maxValuePerTx      Maximum ETH (in wei) per single transaction.
    /// @param maxValuePerDay     Maximum cumulative ETH (in wei) per UTC day.
    /// @param active             Whether the policy is currently enforced.
    ///
    /// Design note (v1): deliberately minimal. A general condition DSL
    /// (e.g. price ceilings) is out of scope for this hackathon submission;
    /// see README § "Future work" for the v2 roadmap.
    struct Policy {
        address[] whitelistedTargets;
        uint256 maxValuePerTx;
        uint256 maxValuePerDay;
        bool active;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted whenever a Safe's policy changes.
    event PolicyUpdated(address indexed safe);

    // -------------------------------------------------------------------------
    // Mutations
    // -------------------------------------------------------------------------

    /// @notice Set or replace the caller's Safe policy.
    /// @dev MUST be called by the Safe itself (i.e. through a signed multisig
    ///      transaction where `msg.sender == safe`). This ensures the full
    ///      owner-quorum has approved the policy before it takes effect.
    /// @param policy The new policy to store.
    function setPolicy(Policy calldata policy) external;

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Return the stored policy for `safe`.
    /// @dev Returns an empty/inactive struct if no policy has been set.
    function getPolicy(address safe) external view returns (Policy memory);

    /// @notice Returns true if `target` is in `safe`'s whitelist.
    function isTargetWhitelisted(
        address safe,
        address target
    ) external view returns (bool);
}
