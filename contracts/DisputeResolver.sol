// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IAttesterRegistry {
    function slash(address a, uint256 amt, address payTo) external;
    function bond(address a) external view returns (uint256);
}

interface ILoanRegistry {
    function loans(uint256 id) external view returns (
        address lender, address borrower, uint256 principal,
        uint64 issuedAt, uint64 dueAt, uint64 defaultedAt, uint8 state
    );
}

/// @title DisputeResolver
/// @notice A fraud challenge may be raised against a relied-on attestation after
///         a default. Evidence is evaluated OFF-CHAIN (a contract cannot read
///         HCS); the arbiter posts the ruling. Uphold ⇒ slash. Honest default ⇒
///         no slash — the incentive-compatibility hinge. Production reference for
///         lib/contracts.ts.
contract DisputeResolver is AccessControl {
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    IAttesterRegistry public registry;
    ILoanRegistry public loanRegistry;
    uint64 public challengeWindow; // seconds after default

    struct Challenge {
        uint256 loanId;
        uint64 attestationSeq;
        address attester;
        address payTo;
        string evidenceURI;
        bool ruled;
        bool upheld;
    }

    mapping(uint256 => Challenge) public challenges;
    uint256 public nextChallengeId = 1;

    event ChallengeRaised(uint256 indexed id, uint256 indexed loanId, uint64 attestationSeq);
    event ChallengeRuled(uint256 indexed id, bool upheld, uint256 slashed);

    constructor(address _registry, address _loanRegistry, uint64 _window, address arbiter) {
        registry = IAttesterRegistry(_registry);
        loanRegistry = ILoanRegistry(_loanRegistry);
        challengeWindow = _window;
        _grantRole(DEFAULT_ADMIN_ROLE, arbiter);
        _grantRole(ARBITER_ROLE, arbiter);
    }

    /// @param attester shared identity that posted the challenged attestation
    /// @param payTo    the lender to compensate if upheld
    function raiseChallenge(
        uint256 loanId,
        uint64 attestationSeq,
        address attester,
        address payTo,
        string calldata evidenceURI
    ) external returns (uint256 id) {
        (, , , , , uint64 defaultedAt, uint8 state) = loanRegistry.loans(loanId);
        require(state == 2, "loan not defaulted");
        require(block.timestamp <= defaultedAt + challengeWindow, "window closed");
        id = nextChallengeId++;
        challenges[id] = Challenge(loanId, attestationSeq, attester, payTo, evidenceURI, false, false);
        emit ChallengeRaised(id, loanId, attestationSeq);
    }

    function rule(uint256 challengeId, bool upheld) external onlyRole(ARBITER_ROLE) {
        Challenge storage c = challenges[challengeId];
        require(!c.ruled, "already ruled");
        c.ruled = true;
        c.upheld = upheld;
        uint256 slashed = 0;
        if (upheld) {
            slashed = registry.bond(c.attester) / 2; // slash half; partial comp
            registry.slash(c.attester, slashed, c.payTo);
        }
        emit ChallengeRuled(challengeId, upheld, slashed);
    }
}
