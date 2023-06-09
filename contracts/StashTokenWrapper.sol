// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IBooster.sol";

contract StashTokenWrapper {
    using SafeERC20 for ERC20;

    address public immutable booster;

    address public token;
    address public rewardPool;
    bool public isInvalid;

    constructor(address _booster) {
        booster = _booster;
    }

    function init(address _token, address _rewardpool) external {
        require(token == address(0), "init");

        token = _token;
        rewardPool = _rewardpool;
    }

    function name() external view returns (string memory) {
        return ERC20(token).name();
    }

    function symbol() external view returns (string memory) {
        return ERC20(token).symbol();
    }

    function decimals() external view returns (uint8) {
        return ERC20(token).decimals();
    }

    function totalSupply() public view returns (uint256) {
        return ERC20(token).balanceOf(address(this));
    }

    function balanceOf(address _account) external view returns (uint256) {
        if (_account == rewardPool) {
            return totalSupply();
        }
        return 0;
    }

    function transfer(
        address _recipient,
        uint256 _amount
    ) external returns (bool) {
        if (msg.sender == rewardPool) {
            ERC20(token).safeTransfer(_recipient, _amount);
        }
        return true;
    }

    function setInvalid(bool _isInvalid) external {
        require(IBooster(booster).owner() == msg.sender, "!owner");

        isInvalid = _isInvalid;
    }
}
