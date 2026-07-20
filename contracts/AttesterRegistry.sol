// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AttesterRegistry
/// @notice Holds attester bonds and accreditation; slashing is triggered only by
///         the DisputeResolver. Production reference for lib/contracts.ts.
contract AttesterRegistry is AccessControl {
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    mapping(address => uint256) public bond;         // locked stake
    mapping(address => bool)    public accredited;   // governance-approved
    mapping(address => uint256) public withdrawableAt; // 0 until requestWithdraw()
    uint256 public minBond;
    uint256 public cooldown;

    // set by DisputeResolver so this contract can block withdrawals mid-dispute
    mapping(address => uint256) public openDisputes;

    event AttesterBonded(address indexed a, uint256 amt);
    event AttesterAccredited(address indexed a);
    event AttesterSlashed(address indexed a, uint256 amt, address payTo);
    event WithdrawRequested(address indexed a, uint256 at);
    event BondWithdrawn(address indexed a, uint256 amt);

    constructor(uint256 _minBond, uint256 _cooldown, address gov) {
        minBond = _minBond;
        cooldown = _cooldown;
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
    }

    function registerAttester() external payable {
        require(msg.value >= minBond || bond[msg.sender] + msg.value >= minBond, "below minBond");
        bond[msg.sender] += msg.value;
        emit AttesterBonded(msg.sender, msg.value);
    }

    function accredit(address a) external onlyRole(GOV_ROLE) {
        accredited[a] = true;
        emit AttesterAccredited(a);
    }

    function requestWithdraw() external {
        withdrawableAt[msg.sender] = block.timestamp + cooldown;
        emit WithdrawRequested(msg.sender, withdrawableAt[msg.sender]);
    }

    function withdrawBond() external {
        require(withdrawableAt[msg.sender] != 0, "requestWithdraw first");
        require(block.timestamp >= withdrawableAt[msg.sender], "cooldown");
        require(openDisputes[msg.sender] == 0, "open disputes");
        uint256 amt = bond[msg.sender];
        bond[msg.sender] = 0;
        withdrawableAt[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amt}("");
        require(ok, "transfer failed");
        emit BondWithdrawn(msg.sender, amt);
    }

    /// @notice Slash — resolver only. Pays the slashed amount to `payTo` (lender).
    function slash(address a, uint256 amt, address payTo) external onlyRole(RESOLVER_ROLE) {
        uint256 slashed = amt > bond[a] ? bond[a] : amt;
        bond[a] -= slashed;
        (bool ok, ) = payable(payTo).call{value: slashed}("");
        require(ok, "payout failed");
        emit AttesterSlashed(a, slashed, payTo);
    }

    function setOpenDisputes(address a, uint256 n) external onlyRole(RESOLVER_ROLE) {
        openDisputes[a] = n;
    }
}
