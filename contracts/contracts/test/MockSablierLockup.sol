// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockSablierLockup
/// @notice Mock Sablier V2 Lockup contract for local testing of NoxRecipientProxy.
contract MockSablierLockup {
    struct Stream {
        address sender;
        address recipient;
        uint128 withdrawable;
        address token;
    }

    mapping(uint256 => Stream) public streams;

    event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, uint128 amount);
    event WithdrawMaxExecuted(uint256 indexed streamId, address indexed to, uint128 amount);

    function createStream(
        uint256 streamId,
        address sender,
        address recipient,
        uint128 withdrawableAmount,
        address token
    ) external {
        streams[streamId] = Stream({
            sender: sender,
            recipient: recipient,
            withdrawable: withdrawableAmount,
            token: token
        });
        emit StreamCreated(streamId, sender, recipient, withdrawableAmount);
    }

    function setWithdrawable(uint256 streamId, uint128 amount) external {
        streams[streamId].withdrawable = amount;
    }

    function getSender(uint256 streamId) external view returns (address) {
        return streams[streamId].sender;
    }

    function getRecipient(uint256 streamId) external view returns (address) {
        return streams[streamId].recipient;
    }

    function withdrawableAmountOf(uint256 streamId) external view returns (uint128) {
        return streams[streamId].withdrawable;
    }

    function withdrawMax(uint256 streamId, address to) external payable returns (uint128 amount) {
        Stream storage s = streams[streamId];
        amount = s.withdrawable;
        s.withdrawable = 0;

        if (s.token != address(0) && amount > 0) {
            IERC20(s.token).transfer(to, amount);
        }

        emit WithdrawMaxExecuted(streamId, to, amount);
    }
}
