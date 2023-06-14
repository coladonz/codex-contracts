// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Interfaces.sol";

/*
Immutable pool manager proxy to enforce that there are no multiple pools of the same gauge
as well as new lp tokens are not gauge tokens
*/
contract PoolManagerProxy {
    address public immutable booster;
    address public owner;
    address public operator;

    constructor(address _booster) {
        booster = _booster;
        owner = msg.sender;
        operator = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operator == msg.sender, "!op");
        _;
    }

    //set owner - only OWNER
    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
    }

    //set operator - only OWNER
    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
    }

    // sealed to be immutable
    // function revertControl() external{
    // }

    //shutdown a pool - only OPERATOR
    function shutdownPool(uint256 _pid) external onlyOperator returns (bool) {
        return IPools(booster).shutdownPool(_pid);
    }

    //add a new pool - only OPERATOR
    function addPool(
        address _lptoken,
        address _gauge,
        uint256 _stashVersion
    ) external onlyOperator returns (bool) {
        require(_gauge != address(0), "gauge is 0");
        require(_lptoken != address(0), "lp token is 0");

        //check if a pool with this gauge already exists
        bool gaugeExists = IPools(booster).gaugeMap(_gauge);
        require(!gaugeExists, "already registered gauge");

        //must also check that the lp token is not a registered gauge
        //because bunni gauges are tokenized
        gaugeExists = IPools(booster).gaugeMap(_lptoken);
        require(!gaugeExists, "already registered lptoken");

        return IPools(booster).addPool(_lptoken, _gauge, _stashVersion);
    }
}
