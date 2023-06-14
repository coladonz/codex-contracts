// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Interfaces.sol";
import "./interfaces/IGaugeController.sol";
import "./interfaces/IPoolAddHook.sol";

/*
Pool Manager v4

Changes:
- add is killed check
- add block list for things like vefunder
- add post pool add hook
*/

contract PoolManagerV4 {
    address public constant gaugeController =
        address(0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218);
    address public immutable pools;

    address public operator;

    address public postAddHook;

    constructor(address _pools) {
        operator = msg.sender;
        pools = _pools;
    }

    function setOperator(address _operator) external {
        require(msg.sender == operator, "!auth");
        operator = _operator;
    }

    function setPostAddHook(address _hook) external {
        require(msg.sender == operator, "!auth");
        postAddHook = _hook;
    }

    //add a new bunni pool to the system. (default stash to v3)
    function addPool(address _gauge) external returns (bool) {
        _addPool(_gauge, 3);
        return true;
    }

    //add a new bunni pool to the system.
    function addPool(
        address _gauge,
        uint256 _stashVersion
    ) external returns (bool) {
        _addPool(_gauge, _stashVersion);
        return true;
    }

    function _addPool(address _gauge, uint256 _stashVersion) internal {
        require(!IGauge(_gauge).is_killed(), "!killed");

        //get lp token from gauge
        address lptoken = IGauge(_gauge).lp_token();

        //gauge/lptoken address checks will happen in the next call
        IPools(pools).addPool(lptoken, _gauge, _stashVersion);

        //call hook if not 0 address
        if (postAddHook != address(0)) {
            IPoolAddHook(postAddHook).poolAdded(
                _gauge,
                _stashVersion,
                IPools(pools).poolLength() - 1
            );
        }
    }

    function forceAddPool(
        address _lptoken,
        address _gauge,
        uint256 _stashVersion
    ) external returns (bool) {
        require(msg.sender == operator, "!auth");

        //force add pool without weight checks (can only be used on new token and gauge addresses)
        return IPools(pools).forceAddPool(_lptoken, _gauge, _stashVersion);
    }

    function shutdownPool(uint256 _pid) external returns (bool) {
        require(msg.sender == operator, "!auth");

        IPools(pools).shutdownPool(_pid);
        return true;
    }
}
