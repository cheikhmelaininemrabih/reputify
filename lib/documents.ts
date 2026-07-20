// Borrower-uploaded documents (proof of asset ownership, utility bills, etc).
// Same off-chain pattern as a cash-flow package: encrypt the file to the
// borrower's own key, store the ciphertext off-chain, anchor only the hash.
// Signed by the borrower's own identity key, not a bonded attester's — there's
// no third party to slash for a document you upload yourself. What this proves
// is tamper-evidence ("this exact file existed as of this hash, on this date"),
// not third-party-verified accuracy the way a throughput attestation is.
import { encryptFileToBorrower } from "./pkg-crypto";
import { submitAttestation } from "./attestation";
import { rdb, rsave, raudit } from "./rep-db";
import type { AssetDocument, AssetKind, Attester } from "./rep-types";

export async function uploadDocument(
  borrowerId: string, kind: AssetKind, label: string, fileBase64: string, mime: string,
): Promise<AssetDocument> {
  const b = rdb.borrowers[borrowerId];
  if (!b) throw new Error("unknown borrower");
  if (b.kyc.status !== "verified") throw new Error("complete KYC before uploading documents");
  if (!label.trim()) throw new Error("label is required");

  const id = `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const uri = `blob://${borrowerId}/documents/${id}`;
  const blob = encryptFileToBorrower(fileBase64, b.wallet.encPublicKey, {
    uri, ownerBorrowerId: borrowerId, filename: label, mime,
  });
  rdb.files[uri] = blob;

  const selfAttester: Attester = {
    address: b.wallet.address, name: b.name,
    signPublicKey: b.wallet.signPublicKey, signPrivateKey: b.wallet.signPrivateKey,
    accredited: false, bond: 0, createdAt: b.createdAt,
  };
  const period = new Date().toISOString().slice(0, 7);
  const attestation = await submitAttestation({
    attester: selfAttester, attesterSignPrivKey: b.wallet.signPrivateKey,
    subject: borrowerId, type: "document", period, hash: blob.hash, packageUri: uri,
  });

  const doc: AssetDocument = {
    id, borrowerId, kind, label, fileUri: uri, hash: blob.hash, mime,
    uploadedAt: new Date().toISOString(), attestationSeq: attestation.seq,
  };
  rdb.documents[id] = doc;
  rsave();
  raudit({ actor: b.name, action: `uploaded document (${kind}): ${label}`, subject: borrowerId, ref: `seq:${attestation.seq}` });
  return doc;
}

export function documentsForBorrower(borrowerId: string): AssetDocument[] {
  return Object.values(rdb.documents)
    .filter((d) => d.borrowerId === borrowerId)
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}
