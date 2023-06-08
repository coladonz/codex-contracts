// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Interfaces.sol";
import "./BaseRewardPool.sol";
import "./VirtualBalanceRewardPool.sol";

contract RewardFactory is IRewardFactory {
    address public constant oLIT =
        address(0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa); // oLIT

    address public operator;
    mapping(address => bool) private rewardAccess;
    mapping(address => uint256[]) public rewardActiveList;

    constructor(address _operator) {
        operator = _operator;
    }

    //Get active count function
    function activeRewardCount(
        address _reward
    ) external view override returns (uint256) {
        return rewardActiveList[_reward].length;
    }

    function addActiveReward(
        address _reward,
        uint256 _pid
    ) external returns (bool) {
        require(rewardAccess[msg.sender] == true, "!auth");
        if (_reward == address(0)) {
            return true;
        }

        uint256[] storage activeList = rewardActiveList[_reward];
        uint256 pid = _pid + 1; //offset by 1 so that we can use 0 as empty

        uint256 length = activeList.length;
        for (uint256 i = 0; i < length; i++) {
            if (activeList[i] == pid) return true;
        }
        activeList.push(pid);
        return true;
    }

    function removeActiveReward(
        address _reward,
        uint256 _pid
    ) external returns (bool) {
        require(rewardAccess[msg.sender] == true, "!auth");
        if (_reward == address(0)) {
            return true;
        }

        uint256[] storage activeList = rewardActiveList[_reward];
        uint256 pid = _pid + 1; //offset by 1 so that we can use 0 as empty

        uint256 length = activeList.length;
        for (uint256 i = 0; i < length; i++) {
            if (activeList[i] == pid) {
                if (i != length - 1) {
                    activeList[i] = activeList[length - 1];
                }
                activeList.pop();
                break;
            }
        }
        return true;
    }

    //stash contracts need access to create new Virtual balance pools for extra gauge incentives(ex. snx)
    function setAccess(address _stash, bool _status) external override {
        require(msg.sender == operator, "!auth");
        rewardAccess[_stash] = _status;
    }

    //Create a Managed Reward Pool to handle distribution of all oLIT mined in a pool
    function CreateOLITRewards(
        uint256 _pid,
        address _depositToken
    ) external override returns (address) {
        require(msg.sender == operator, "!auth");

        //operator = booster(deposit) contract so that new oLIT can be added and distributed
        //reward manager = this factory so that extra incentive tokens(ex. snx) can be linked to the main managed reward pool
        BaseRewardPool rewardPool = new BaseRewardPool(
            _pid,
            _depositToken,
            oLIT,
            operator,
            address(this)
        );
        return address(rewardPool);
    }

    //create a virtual balance reward pool that mimicks the balance of a pool's main reward contract
    //used for extra incentive tokens(ex. snx) as well as velit fees
    function CreateTokenRewards(
        address _token,
        address _mainRewards,
        address _operator
    ) external override returns (address) {
        require(
            msg.sender == operator || rewardAccess[msg.sender] == true,
            "!auth"
        );

        //create new pool, use main pool for balance lookup
        VirtualBalanceRewardPool rewardPool = new VirtualBalanceRewardPool(
            _mainRewards,
            _token,
            _operator
        );
        address rAddress = address(rewardPool);
        //add the new pool to main pool's list of extra rewards, assuming this factory has "reward manager" role
        IRewards(_mainRewards).addExtraReward(rAddress);
        //return new pool's address
        return rAddress;
    }
}
