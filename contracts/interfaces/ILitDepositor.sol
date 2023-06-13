// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface ILitDepositor {
    function deposit(uint256, bool) external;

    function lockIncentive() external view returns (uint256);
}
