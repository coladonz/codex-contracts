// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IRewardHook {
    function onRewardClaim() external;
}
