// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LoanRegistry
/// @notice Records off-chain fiat loans and the attestations each relied on. No
///         value is transferred here — `principal` is data (NGN minor units).
///         Production reference for lib/contracts.ts.
contract LoanRegistry {
    enum State { Active, Repaid, Defaulted }

    struct Loan {
        address lender;
        address borrower;
        uint256 principal;   // NGN minor units (data, not value)
        uint64 issuedAt;
        uint64 dueAt;
        uint64 defaultedAt;
        State state;
        uint64[] reliedOn;   // HCS attestation sequence numbers
    }

    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId = 1;

    event LoanIssued(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal);
    event LoanStateChanged(uint256 indexed loanId, State s);

    function issueLoan(
        address borrower,
        uint256 principal,
        uint64 dueAt,
        uint64[] calldata reliedOn
    ) external returns (uint256 loanId) {
        loanId = nextLoanId++;
        Loan storage l = loans[loanId];
        l.lender = msg.sender;
        l.borrower = borrower;
        l.principal = principal;
        l.issuedAt = uint64(block.timestamp);
        l.dueAt = dueAt;
        l.state = State.Active;
        l.reliedOn = reliedOn;
        emit LoanIssued(loanId, borrower, msg.sender, principal);
    }

    function markRepaid(uint256 loanId) external {
        Loan storage l = loans[loanId];
        require(l.lender == msg.sender, "lender only");
        require(l.state == State.Active, "not active");
        l.state = State.Repaid;
        emit LoanStateChanged(loanId, State.Repaid);
    }

    function markDefaulted(uint256 loanId) external {
        Loan storage l = loans[loanId];
        require(l.lender == msg.sender, "lender only");
        require(l.state == State.Active, "not active");
        l.state = State.Defaulted;
        l.defaultedAt = uint64(block.timestamp);
        emit LoanStateChanged(loanId, State.Defaulted);
    }

    function reliedOnOf(uint256 loanId) external view returns (uint64[] memory) {
        return loans[loanId].reliedOn;
    }
}
