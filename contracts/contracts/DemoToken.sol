// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal mintable ERC20 for the Nox-Safe demo Sablier stream.
///         Deployed once by the oracle wallet; minter == deployer.
contract DemoToken is ERC20 {
    address public immutable minter;

    constructor() ERC20("Nox Demo Token", "NDT") {
        minter = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "!minter");
        _mint(to, amount);
    }
}
