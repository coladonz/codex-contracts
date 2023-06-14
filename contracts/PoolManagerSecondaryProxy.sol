// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Interfaces.sol";
import "./interfaces/IGaugeController.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/*
Immutable pool manager proxy to enforce that when a pool is shutdown, the proper number
of lp tokens are returned to the booster contract for withdrawal
*/
contract PoolManagerSecondaryProxy {
    using SafeMath for uint256;

    address public constant gaugeController =
        address(0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218);
    address public immutable pools;
    address public immutable booster;
    address public owner;
    address public operator;
    bool public isShutdown;

    mapping(address => bool) public usedMap;

    constructor(address _booster, address _poolManagerProxy) {
        booster = _booster;
        pools = _poolManagerProxy;
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

    //manual set an address to used state
    function setUsedAddress(address[] memory usedList) external onlyOwner {
        for (uint i = 0; i < usedList.length; i++) {
            usedMap[usedList[i]] = true;
        }
    }

    //shutdown pool management and disallow new pools. change is immutable
    function shutdownSystem() external onlyOwner {
        isShutdown = true;
    }

    //shutdown a pool - only OPERATOR
    function shutdownPool(uint256 _pid) external onlyOperator returns (bool) {
        //get pool info
        (address lptoken, address depositToken, , , , bool isshutdown) = IPools(
            booster
        ).poolInfo(_pid);
        require(!isshutdown, "already shutdown");

        //shutdown pool and get before and after amounts
        uint256 beforeBalance = IERC20(lptoken).balanceOf(booster);
        IPools(pools).shutdownPool(_pid);
        uint256 afterBalance = IERC20(lptoken).balanceOf(booster);

        //check that proper amount of tokens were withdrawn(will also fail if already shutdown)
        require(
            afterBalance.sub(beforeBalance) >=
                IERC20(depositToken).totalSupply(),
            "supply mismatch"
        );

        return true;
    }

    //add a new pool if it has weight on the gauge controller - only OPERATOR
    function addPool(
        address _lptoken,
        address _gauge,
        uint256 _stashVersion
    ) external onlyOperator returns (bool) {
        //check that the pool as weight
        uint256 weight = IGaugeController(gaugeController).get_gauge_weight(
            _gauge
        );
        require(weight > 0, "must have weight");

        return _addPool(_lptoken, _gauge, _stashVersion);
    }

    //force add a new pool, but only for addresses that have never been used before - only OPERATOR
    function forceAddPool(
        address _lptoken,
        address _gauge,
        uint256 _stashVersion
    ) external onlyOperator returns (bool) {
        require(!usedMap[_lptoken] && !usedMap[_gauge], "cant force used pool");

        return _addPool(_lptoken, _gauge, _stashVersion);
    }

    //internal add pool and updated used list
    function _addPool(
        address _lptoken,
        address _gauge,
        uint256 _stashVersion
    ) internal returns (bool) {
        require(!isShutdown, "shutdown");

        usedMap[_lptoken] = true;
        usedMap[_gauge] = true;

        return IPools(pools).addPool(_lptoken, _gauge, _stashVersion);
    }
}
