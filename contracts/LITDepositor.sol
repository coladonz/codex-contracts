// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./cdxLIT.sol";
import "./interfaces/IRewards.sol";
import "./interfaces/IStaker.sol";

/// @notice fork of CrvDepositor from convexfinance
contract LITDepositor {
    using SafeERC20 for IERC20;
    using Address for address;

    address public constant want =
        address(0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C); // Balancer 20WETH/80LIT
    address public constant escrow =
        address(0xf17d23136B4FeAd139f54fB766c8795faae09660); // veLIT
    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public lockIncentive = 10; // incentive to users who spend gas to lock LIT
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public feeManager;
    address public immutable staker;
    address public immutable minter;
    uint256 public incentiveWant = 0;
    uint256 public unlockTime;

    constructor(address _staker, address _minter) public {
        staker = _staker;
        minter = _minter;
        feeManager = msg.sender;
    }

    function setFeeManager(address _feeManager) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeManager;
    }

    function setFees(uint256 _lockIncentive) external {
        require(msg.sender == feeManager, "!auth");

        if (_lockIncentive >= 0 && _lockIncentive <= 30) {
            lockIncentive = _lockIncentive;
        }
    }

    function initialLock() external {
        require(msg.sender == feeManager, "!auth");

        uint256 velit = IERC20(escrow).balanceOf(staker);
        if (velit == 0) {
            uint256 unlockAt = block.timestamp + MAXTIME;
            uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

            // release old lock if exists
            IStaker(staker).release();

            // create new lock
            uint256 wantBalanceStaker = IERC20(want).balanceOf(staker);
            IStaker(staker).createLock(wantBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    /// @dev lock Balancer 20WETH/80LIT for veLIT
    function _lockWant() internal {
        uint256 wantBalance = IERC20(want).balanceOf(address(this));
        if (wantBalance > 0) {
            IERC20(want).safeTransfer(staker, wantBalance);
        }

        uint256 wantBalanceStaker = IERC20(want).balanceOf(staker);
        if (wantBalanceStaker == 0) {
            return;
        }

        // increase amount
        IStaker(staker).increaseAmount(wantBalanceStaker);

        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

        // increase time too if over 2 week buffer
        if (unlockInWeeks - unlockTime > 2) {
            IStaker(staker).increaseTime(unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    function lockWant() external {
        _lockWant();

        // mint incentives
        if (incentiveWant > 0) {
            cdxLIT(minter).mint(msg.sender, incentiveWant);
            incentiveWant = 0;
        }
    }

    /// @dev deposit Balancer 20WETH/80LIT for cdxLIT
    /// can locking immediately or defer locking to someone else by paying a fee.
    /// while users can choose to lock or defer, this is mostly in place so that
    /// the cdx reward contract isnt costly to claim rewards
    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) public {
        require(_amount > 0, "!>0");

        if (_lock) {
            // lock immediately, transfer directly to staker to skip an erc20 transfer
            IERC20(want).safeTransferFrom(msg.sender, staker, _amount);
            _lockWant();
            if (incentiveWant > 0) {
                // add the incentive tokens here so they can be staked together
                _amount += incentiveWant;
                incentiveWant = 0;
            }
        } else {
            // move tokens here
            IERC20(want).safeTransferFrom(msg.sender, address(this), _amount);
            // defer lock cost to another user
            uint256 callIncentive = (_amount * lockIncentive) / FEE_DENOMINATOR;
            _amount -= callIncentive;

            // add to a pool for lock caller
            incentiveWant += callIncentive;
        }

        bool depositOnly = _stakeAddress == address(0);
        if (depositOnly) {
            // mint for msg.sender
            cdxLIT(minter).mint(msg.sender, _amount);
        } else {
            // mint here
            cdxLIT(minter).mint(address(this), _amount);

            // stake for msg.sender
            IERC20(minter).safeApprove(_stakeAddress, 0);
            IERC20(minter).safeApprove(_stakeAddress, _amount);
            IRewards(_stakeAddress).stakeFor(msg.sender, _amount);
        }
    }

    function deposit(uint256 _amount, bool _lock) external {
        deposit(_amount, _lock, address(0));
    }

    function depositAll(bool _lock, address _stakeAddress) external {
        uint256 wantBalance = IERC20(want).balanceOf(msg.sender);
        deposit(wantBalance, _lock, _stakeAddress);
    }
}
