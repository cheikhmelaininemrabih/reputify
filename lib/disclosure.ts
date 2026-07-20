// Selective per-lender disclosure (roadmap §5/§9). A lender requests granular
// access; the borrower taps Allow; the custodial wallet releases the data key
// (PoC simplification — production = proxy re-encryption / client-side re-wrap).
// The lender then re-hashes each received package and checks it against the hash
// anchored on-chain ("verify-on-receipt") before trusting it → the Verified ✓.
import crypto from "node:crypto";
import { decryptFile, decryptPackage, fileHash, verifyOnReceipt } from "./pkg-crypto";
import { attestationsForSubject, attestationExplorerUrls } from "./attestation";
import { isSubscribed } from "./billing";
import { rdb, rsave, raudit } from "./rep-db";
import type { AssetDocument, Disclosure, GranularPackage } from "./rep-types";

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
  attesterName: string; // who vouched for this data
  proof: { mirror: string; hashscan: string } | null; // click through to the real Hedera record
}

export interface VerifiedDocument extends Pick<AssetDocument, "id" | "kind" | "label" | "mime" | "uploadedAt"> {
  verified: boolean;
  attestationSeq?: number;
  proof: { mirror: string; hashscan: string } | null;
}

/** The lender's granular view. Two gates, in order: (1) the borrower must have
 *  allowed disclosure, (2) the lender must have an active subscription — without
 *  one they still know disclosure was granted, just not the contents (roadmap
 *  monetization: the summary is always free, verified detail is the product). */
export function lenderGranularView(borrowerId: string, lenderId: string): {
  allowed: boolean; subscribed: boolean; packages: VerifiedPackage[]; documents: VerifiedDocument[];
} {
  const allowed = Object.values(rdb.disclosures).some(
    (d) => d.borrowerId === borrowerId && d.lenderId === lenderId && d.state === "allowed" && d.released,
  );
  const subscribed = isSubscribed(lenderId);
  if (!allowed || !subscribed) return { allowed, subscribed, packages: [], documents: [] };

  const borrower = rdb.borrowers[borrowerId];
  const atts = attestationsForSubject(borrowerId);

  const packages: VerifiedPackage[] = [];
  for (const att of atts.filter((a) => a.type === "throughput")) {
    const blob = rdb.packages[att.packageUri];
    if (!blob) continue;
    try {
      const pkg = decryptPackage(blob, borrower.wallet.encPrivateKey);
      packages.push({
        ...pkg, verified: verifyOnReceipt(pkg, att.hash), attestationSeq: att.seq,
        attesterName: rdb.attesters[att.attester]?.name ?? att.attester,
        proof: attestationExplorerUrls(att),
      });
    } catch {
      /* undecryptable blob — skip */
    }
  }

  const documents: VerifiedDocument[] = [];
  for (const doc of Object.values(rdb.documents).filter((d) => d.borrowerId === borrowerId)) {
    const att = doc.attestationSeq != null ? rdb.attestations[doc.attestationSeq] : undefined;
    const blob = rdb.files[doc.fileUri];
    let verified = false;
    if (att && blob) {
      try {
        const base64 = decryptFile(blob, borrower.wallet.encPrivateKey);
        verified = fileHash(base64) === att.hash;
      } catch {
        /* undecryptable blob — leave unverified */
      }
    }
    documents.push({
      id: doc.id, kind: doc.kind, label: doc.label, mime: doc.mime, uploadedAt: doc.uploadedAt,
      verified, attestationSeq: doc.attestationSeq,
      proof: att ? attestationExplorerUrls(att) : null,
    });
  }

  return { allowed: true, subscribed: true, packages, documents };
}
