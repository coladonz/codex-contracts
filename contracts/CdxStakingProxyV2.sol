// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./interfaces/ILitDepositor.sol";

interface ICodexRewards {
    function withdraw(uint256 _amount, bool _claim) external;

    function balanceOf(address _account) external view returns (uint256);

    function getReward(bool _stake) external;

    function stakeAll() external;
}

interface ICdxLocker {
    function notifyRewardAmount(address _rewardsToken, uint256 reward) external;
}

// receive tokens to stake
// get current staked balance
// withdraw staked tokens
// send rewards back to owner(cdx locker)
// register token types that can be distributed

contract CdxStakingProxyV2 {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //tokens
    address public constant want =
        address(0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C); // Balancer 20WETH/80LIT
    address public immutable cdx;
    address public immutable cdxLit;

    //codex addresses
    address public immutable cdxStaking; // CdxRewardPool
    address public immutable cdxLitStaking; // BaseRewardPool
    address public immutable litDeposit;
    uint256 public constant denominator = 10000;

    address public immutable rewards;

    address public owner;
    address public pendingOwner;
    uint256 public callIncentive = 100;

    mapping(address => bool) public distributors;
    bool public UseDistributors = true;

    event AddDistributor(address indexed _distro, bool _valid);
    event RewardsDistributed(address indexed token, uint256 amount);

    constructor(
        address _cdx,
        address _cdxLit,
        address _cdxStaking,
        address _cdxLitStaking,
        address _litDeposit,
        address _rewards
    ) {
        cdx = _cdx;
        cdxLit = _cdxLit;
        cdxStaking = _cdxStaking;
        cdxLitStaking = _cdxLitStaking;
        litDeposit = _litDeposit;
        rewards = _rewards;
        owner = msg.sender;
        distributors[msg.sender] = true;
    }

    function setPendingOwner(address _po) external {
        require(msg.sender == owner, "!auth");
        pendingOwner = _po;
    }

    function applyPendingOwner() external {
        require(msg.sender == owner, "!auth");
        require(pendingOwner != address(0), "invalid owner");

        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function setCallIncentive(uint256 _incentive) external {
        require(msg.sender == owner, "!auth");
        require(_incentive <= 100, "too high");
        callIncentive = _incentive;
    }

    function setDistributor(address _distro, bool _valid) external {
        require(msg.sender == owner, "!auth");
        distributors[_distro] = _valid;
        emit AddDistributor(_distro, _valid);
    }

    function setUseDistributorList(bool _use) external {
        require(msg.sender == owner, "!auth");
        UseDistributors = _use;
    }

    function setApprovals() external {
        IERC20(cdx).safeApprove(cdxStaking, 0);
        IERC20(cdx).safeApprove(cdxStaking, type(uint256).max);

        IERC20(want).safeApprove(litDeposit, 0);
        IERC20(want).safeApprove(litDeposit, type(uint256).max);

        IERC20(cdxLit).safeApprove(rewards, 0);
        IERC20(cdxLit).safeApprove(rewards, type(uint256).max);
    }

    function rescueToken(address _token, address _to) external {
        require(msg.sender == owner, "!auth");
        require(
            _token != want && _token != cdx && _token != cdxLit,
            "not allowed"
        );

        uint256 bal = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_to, bal);
    }

    function getBalance() external view returns (uint256) {
        return ICodexRewards(cdxStaking).balanceOf(address(this));
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == rewards, "!auth");

        //unstake
        ICodexRewards(cdxStaking).withdraw(_amount, false);

        //withdraw cdx
        IERC20(cdx).safeTransfer(msg.sender, _amount);
    }

    function stake() external {
        require(msg.sender == rewards, "!auth");

        ICodexRewards(cdxStaking).stakeAll();
    }

    function distribute() external {
        if (UseDistributors) {
            require(distributors[msg.sender], "!auth");
        }

        //claim rewards
        ICodexRewards(cdxStaking).getReward(false);

        //convert any Balancer 20WETH/80LIT that was directly added
        uint256 wantBal = IERC20(want).balanceOf(address(this));
        if (wantBal > 0) {
            ILitDepositor(litDeposit).deposit(wantBal, true);
        }

        //make sure nothing is in here
        uint256 sCheck = ICodexRewards(cdxLitStaking).balanceOf(address(this));
        if (sCheck > 0) {
            ICodexRewards(cdxLitStaking).withdraw(sCheck, false);
        }

        //distribute cdxlit
        uint256 cdxLitBal = IERC20(cdxLit).balanceOf(address(this));

        if (cdxLitBal > 0) {
            uint256 incentiveAmount = cdxLitBal.mul(callIncentive).div(
                denominator
            );
            cdxLitBal = cdxLitBal.sub(incentiveAmount);

            //send incentives
            IERC20(cdxLit).safeTransfer(msg.sender, incentiveAmount);

            //update rewards
            ICdxLocker(rewards).notifyRewardAmount(cdxLit, cdxLitBal);

            emit RewardsDistributed(cdxLit, cdxLitBal);
        }
    }

    //in case a new reward is ever added, allow generic distribution
    function distributeOther(IERC20 _token) external {
        require(
            address(_token) != want && address(_token) != cdxLit,
            "not allowed"
        );

        uint256 bal = _token.balanceOf(address(this));

        if (bal > 0) {
            uint256 incentiveAmount = bal.mul(callIncentive).div(denominator);
            bal = bal.sub(incentiveAmount);

            //send incentives
            _token.safeTransfer(msg.sender, incentiveAmount);

            //approve
            _token.safeApprove(rewards, 0);
            _token.safeApprove(rewards, type(uint256).max);

            //update rewards
            ICdxLocker(rewards).notifyRewardAmount(address(_token), bal);

            emit RewardsDistributed(address(_token), bal);
        }
    }
}
