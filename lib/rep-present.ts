// Public DTO shaping for the roadmap system — never leak custodial private keys.
import { rdb } from "./rep-db";
import type { Attester, Borrower, Lender } from "./rep-types";

export function publicLender(l: Lender) {
  return { id: l.id, name: l.name, createdAt: l.createdAt };
}

export function publicBorrower(b: Borrower) {
  return {
    id: b.id,
    name: b.name,
    phone: b.phone,
    did: b.wallet.did,
    address: b.wallet.address,
    createdAt: b.createdAt,
    defaulted: !!b.defaulted,
    kyc: { status: b.kyc.status, distance: b.kyc.distance, matched: b.kyc.matched, verifiedAt: b.kyc.verifiedAt },
  };
}

/** Includes real track-record stats — the "market discipline" signal that makes
 *  a multi-attester marketplace legible: bond size alone doesn't tell you
 *  whether an attester's data holds up, disputes-upheld does. */
export function publicAttester(a: Attester) {
  const attestations = Object.values(rdb.attestations).filter((m) => m.attester === a.address);
  const seqs = new Set(attestations.map((m) => m.seq));
  const challenges = Object.values(rdb.challenges).filter((c) => seqs.has(c.attestationSeq));
  const upheld = challenges.filter((c) => c.ruled && c.upheld).length;
  return {
    address: a.address,
    name: a.name,
    accredited: a.accredited,
    bond: a.bond,
    withdrawableAt: a.withdrawableAt ?? null,
    createdAt: a.createdAt,
    stats: {
      attestations: attestations.length,
      disputesRaised: challenges.length,
      disputesUpheld: upheld,
    },
  };
}
