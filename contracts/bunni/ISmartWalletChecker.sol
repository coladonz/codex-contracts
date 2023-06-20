// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface ISmartWalletChecker {
    function owner() external view returns (address);

    function check(address contractAddress) external view returns (bool);

    function allowlistAddress(address contractAddress) external;
}
