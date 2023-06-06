// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice fork of cvxCRV from convexfinance
contract cdxLIT is ERC20 {
    address public operator;

    constructor() ERC20("Codex LIT", "cdxLIT") {
        operator = msg.sender;
    }

    function setOperator(address _operator) external {
        require(msg.sender == operator, "!auth");
        operator = _operator;
    }

    function mint(address _to, uint256 _amount) external {
        require(msg.sender == operator, "!authorized");

        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external {
        require(msg.sender == operator, "!authorized");

        _burn(_from, _amount);
    }
}
