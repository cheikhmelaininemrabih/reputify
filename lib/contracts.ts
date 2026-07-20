// World B — the smart-contract logic (roadmap §3), modelled in TypeScript over
// the rep-db store so the whole system runs on the existing stack. The Solidity
// production reference (the real HSCS deployment target) lives in /contracts and
// mirrors these exact interfaces and rules. A contract cannot read HCS during
// execution — so, faithfully, attestation data only enters here as parameters
// (the `reliedOn` sequence numbers passed into issueLoan).
//
// Access control is represented by the `actor`/`by` parameters; in Solidity these
// are msg.sender guarded by OpenZeppelin AccessControl (onlyGov / onlyArbiter /
// lender-only). The honest-vs-fraud outcome lives in the arbiter's ruling, never
// in code — the contract only enforces the consequence (slash on uphold).
import { rdb, nextSeq, rsave, raudit } from "./rep-db";
import { PARAMS } from "./rep-types";
import type { Attester, Challenge, Loan } from "./rep-types";

// ─── AttesterRegistry ────────────────────────────────────────────────────────

export const AttesterRegistry = {
  /** Stake >= minBond to register (or top up an existing bond). */
  registerAttester(
    address: string, name: string,
    keys: { signPublicKey: string; signPrivateKey: string }, amount: number,
  ): Attester {
    if (amount < PARAMS.minBond) throw new Error(`stake below minBond (${PARAMS.minBond})`);
    const existing = rdb.attesters[address];
    const a: Attester = existing ?? {
      address, name, signPublicKey: keys.signPublicKey, signPrivateKey: keys.signPrivateKey,
      accredited: false, bond: 0, createdAt: new Date().toISOString(),
    };
    a.bond += amount;
    rdb.attesters[address] = a;
    rsave();
    raudit({ actor: name, action: `bonded ${amount}`, subject: address, ref: `bond:${a.bond}` });
    return a;
  },

  /** Governance admits an attester. onlyGov. */
  accredit(address: string): Attester {
    const a = mustAttester(address);
    a.accredited = true;
    rsave();
    raudit({ actor: "governance", action: "accredited attester", subject: address });
    return a;
  },

  /** Begin the withdraw cooldown. */
  requestWithdraw(address: string): Attester {
    const a = mustAttester(address);
    a.withdrawableAt = Date.now() + PARAMS.withdrawCooldownMs;
    rsave();
    return a;
  },

  /** Withdraw bond after cooldown — blocked while any dispute against this
   *  attester is still open (the core reason a bond exists). */
  withdrawBond(address: string, now = Date.now()): number {
    const a = mustAttester(address);
    if (a.withdrawableAt == null) throw new Error("call requestWithdraw() first");
    if (now < a.withdrawableAt) throw new Error("still in cooldown");
    if (hasOpenDisputes(address)) throw new Error("cannot withdraw with open disputes");
    const paid = a.bond;
    a.bond = 0;
    a.withdrawableAt = undefined;
    rsave();
    raudit({ actor: a.name, action: `withdrew bond ${paid}`, subject: address });
    return paid;
  },

  /** Slash — only ever called by the DisputeResolver on an upheld challenge. */
  slash(address: string, amount: number, payTo: string): number {
    const a = mustAttester(address);
    const slashed = Math.min(a.bond, amount);
    a.bond -= slashed;
    rsave();
    raudit({ actor: "resolver", action: `slashed ${slashed} → ${payTo}`, subject: address, ref: `bond:${a.bond}` });
    return slashed;
  },

  get: (address: string) => rdb.attesters[address],
  list: () => Object.values(rdb.attesters),
};

function mustAttester(address: string): Attester {
  const a = rdb.attesters[address];
  if (!a) throw new Error("unknown attester");
  return a;
}

/** True if any unruled challenge references an attestation this attester posted. */
export function hasOpenDisputes(address: string): boolean {
  return Object.values(rdb.challenges).some((c) => {
    if (c.ruled) return false;
    const att = rdb.attestations[c.attestationSeq];
    return att?.attester === address;
  });
}

// ─── LoanRegistry ────────────────────────────────────────────────────────────

export const LoanRegistry = {
  /** Issue a loan. `reliedOn` = the HCS attestation seq numbers the lender
   *  trusted; storing them lets a later default trace back to them. `principal`
   *  is data (NGN minor units), never value transferred on-chain. */
  issueLoan(lender: string, borrower: string, principal: number, dueAt: string, reliedOn: number[]): Loan {
    for (const seq of reliedOn) {
      const att = rdb.attestations[seq];
      if (!att) throw new Error(`reliedOn attestation ${seq} does not exist`);
      if (att.subject !== borrower) throw new Error(`attestation ${seq} is not about this borrower`);
    }
    const loanId = nextSeq("loan");
    const loan: Loan = {
      loanId, lender, borrower, principal,
      issuedAt: new Date().toISOString(), dueAt, state: "Active", reliedOn: [...reliedOn],
    };
    rdb.loans[loanId] = loan;
    rsave();
    raudit({ actor: lender, action: `issued loan ${principal}`, subject: borrower, ref: `loan:${loanId}` });
    return loan;
  },

  /** lender-only. */
  markRepaid(loanId: number, by: string): Loan {
    const loan = mustLoan(loanId);
    if (loan.lender !== by) throw new Error("only the lender can update this loan");
    if (loan.state !== "Active") throw new Error(`loan is ${loan.state}, not Active`);
    loan.state = "Repaid";
    rsave();
    raudit({ actor: by, action: "loan repaid", subject: loan.borrower, ref: `loan:${loanId}` });
    return loan;
  },

  /** lender-only. Opens the fraud-challenge window. */
  markDefaulted(loanId: number, by: string): Loan {
    const loan = mustLoan(loanId);
    if (loan.lender !== by) throw new Error("only the lender can update this loan");
    if (loan.state !== "Active") throw new Error(`loan is ${loan.state}, not Active`);
    loan.state = "Defaulted";
    loan.defaultedAt = new Date().toISOString();
    const b = rdb.borrowers[loan.borrower];
    if (b) b.defaulted = true;
    rsave();
    raudit({ actor: by, action: "loan defaulted", subject: loan.borrower, ref: `loan:${loanId}` });
    return loan;
  },

  get: (loanId: number) => rdb.loans[loanId],
  list: () => Object.values(rdb.loans),
  forBorrower: (borrower: string) => Object.values(rdb.loans).filter((l) => l.borrower === borrower),
};

function mustLoan(loanId: number): Loan {
  const l = rdb.loans[loanId];
  if (!l) throw new Error("unknown loan");
  return l;
}

// ─── DisputeResolver ─────────────────────────────────────────────────────────

export const DisputeResolver = {
  /** Raise a fraud challenge against a relied-on attestation of a defaulted loan.
   *  Only valid inside the challenge window; evidence is evaluated off-chain. */
  raiseChallenge(loanId: number, attestationSeq: number, evidenceURI: string, now = Date.now()): Challenge {
    const loan = mustLoan(loanId);
    if (loan.state !== "Defaulted") throw new Error("can only challenge a defaulted loan");
    if (!loan.reliedOn.includes(attestationSeq)) throw new Error("attestation was not relied on for this loan");
    const defaultedAt = loan.defaultedAt ? Date.parse(loan.defaultedAt) : now;
    if (now > defaultedAt + PARAMS.challengeWindowMs) throw new Error("challenge window has closed");
    const challengeId = nextSeq("challenge");
    const c: Challenge = { challengeId, loanId, attestationSeq, evidenceURI, raisedAt: new Date().toISOString(), ruled: false };
    rdb.challenges[challengeId] = c;
    rsave();
    raudit({ actor: loan.lender, action: "raised fraud challenge", subject: loan.borrower, ref: `challenge:${challengeId}` });
    return c;
  },

  /** Arbiter posts the ruling. onlyArbiter. Uphold ⇒ slash the attester and pay
   *  the lender (partial compensation). Honest default ⇒ no slash. This is the
   *  incentive-compatibility hinge. */
  rule(challengeId: number, upheld: boolean): Challenge {
    const c = rdb.challenges[challengeId];
    if (!c) throw new Error("unknown challenge");
    if (c.ruled) throw new Error("challenge already ruled");
    c.ruled = true;
    c.upheld = upheld;
    c.ruledAt = new Date().toISOString();
    if (upheld) {
      const att = rdb.attestations[c.attestationSeq];
      const loan = rdb.loans[c.loanId];
      const attester = att ? rdb.attesters[att.attester] : undefined;
      if (att && loan && attester) {
        const amount = Math.floor(attester.bond * 0.5); // slash half; partial lender comp
        c.slashed = AttesterRegistry.slash(att.attester, amount, loan.lender);
      }
    }
    rsave();
    raudit({ actor: "arbiter", action: `ruled challenge ${upheld ? "UPHELD" : "rejected"}`, ref: `challenge:${challengeId}` });
    return c;
  },

  get: (challengeId: number) => rdb.challenges[challengeId],
  list: () => Object.values(rdb.challenges),
};
