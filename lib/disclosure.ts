// Selective per-lender disclosure (roadmap §5/§9). A lender requests granular
// access; the borrower taps Allow; the custodial wallet releases the data key
// (PoC simplification — production = proxy re-encryption / client-side re-wrap).
// The lender then re-hashes each received package and checks it against the hash
// anchored on-chain ("verify-on-receipt") before trusting it → the Verified ✓.
import crypto from "node:crypto";
import { decryptPackage, verifyOnReceipt } from "./pkg-crypto";
import { attestationsForSubject } from "./attestation";
import { rdb, rsave, raudit } from "./rep-db";
import type { Disclosure, GranularPackage } from "./rep-types";

export function requestDisclosure(borrowerId: string, lenderId: string): Disclosure {
  const id = crypto.randomUUID();
  const d: Disclosure = { id, borrowerId, lenderId, state: "pending", requestedAt: new Date().toISOString() };
  rdb.disclosures[id] = d;
  rsave();
  raudit({ actor: lenderId, action: "requested granular access", subject: borrowerId, ref: `disclosure:${id}` });
  return d;
}

export function pendingDisclosuresForBorrower(borrowerId: string): Disclosure[] {
  return Object.values(rdb.disclosures).filter((d) => d.borrowerId === borrowerId && d.state === "pending");
}

/** Borrower approves/denies. Approval "releases the data key" for that lender. */
export function decideDisclosure(id: string, allow: boolean): Disclosure {
  const d = rdb.disclosures[id];
  if (!d) throw new Error("unknown disclosure request");
  d.state = allow ? "allowed" : "denied";
  d.decidedAt = new Date().toISOString();
  d.released = allow;
  rsave();
  raudit({ actor: d.borrowerId, action: allow ? "allowed disclosure" : "denied disclosure", subject: d.lenderId, ref: `disclosure:${id}` });
  return d;
}

export interface VerifiedPackage extends GranularPackage {
  verified: boolean; // re-hash matched the on-chain attestation hash
  attestationSeq: number;
}

/** The lender's granular view — only if the borrower has allowed it. Each package
 *  is decrypted (custodial), then independently re-hashed and matched against the
 *  attestation on HCS. */
export function lenderGranularView(borrowerId: string, lenderId: string): {
  allowed: boolean; packages: VerifiedPackage[];
} {
  const allowed = Object.values(rdb.disclosures).some(
    (d) => d.borrowerId === borrowerId && d.lenderId === lenderId && d.state === "allowed" && d.released,
  );
  if (!allowed) return { allowed: false, packages: [] };

  const borrower = rdb.borrowers[borrowerId];
  const atts = attestationsForSubject(borrowerId);
  const packages: VerifiedPackage[] = [];
  for (const att of atts) {
    const blob = rdb.packages[att.packageUri];
    if (!blob) continue;
    try {
      const pkg = decryptPackage(blob, borrower.wallet.encPrivateKey);
      packages.push({ ...pkg, verified: verifyOnReceipt(pkg, att.hash), attestationSeq: att.seq });
    } catch {
      /* undecryptable blob — skip */
    }
  }
  return { allowed: true, packages };
}
