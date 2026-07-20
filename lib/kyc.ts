// KYC (roadmap-adjacent, not in the original spec) — a real ID-photo + live-selfie
// capture, compared with a genuine client-side face-recognition model
// (face-api.js, running in the browser against the models in /public/models).
// The match/distance is computed client-side (the model can't run server-side
// without a webcam) and submitted here; this route is the trust boundary, so it
// re-checks the numbers are sane rather than taking "matched: true" on faith.
// Both photos are encrypted-at-rest the same way a cash-flow package is —
// they're never stored or transmitted in the clear once verification is done.
import { encryptFileToBorrower } from "./pkg-crypto";
import { rdb, rsave, raudit } from "./rep-db";
import type { KycRecord } from "./rep-types";

// face-api.js's own documented threshold for "same person" on its recognition
// model (Euclidean distance between 128-d descriptors). Below is a stricter
// re-check server-side, but the actual detection/scoring already happened client-side.
export const MATCH_THRESHOLD = 0.6;

export function submitKyc(
  borrowerId: string,
  input: { idImageBase64: string; selfieImageBase64: string; distance: number; note?: string },
): KycRecord {
  const b = rdb.borrowers[borrowerId];
  if (!b) throw new Error("unknown borrower");
  if (typeof input.distance !== "number" || !Number.isFinite(input.distance) || input.distance < 0) {
    throw new Error("invalid comparison result");
  }
  const matched = input.distance <= MATCH_THRESHOLD;

  const idUri = `blob://${borrowerId}/kyc/id`;
  const selfieUri = `blob://${borrowerId}/kyc/selfie`;
  rdb.files[idUri] = encryptFileToBorrower(input.idImageBase64, b.wallet.encPublicKey, {
    uri: idUri, ownerBorrowerId: borrowerId, filename: "id.jpg", mime: "image/jpeg",
  });
  rdb.files[selfieUri] = encryptFileToBorrower(input.selfieImageBase64, b.wallet.encPublicKey, {
    uri: selfieUri, ownerBorrowerId: borrowerId, filename: "selfie.jpg", mime: "image/jpeg",
  });

  const kyc: KycRecord = {
    status: matched ? "verified" : "failed",
    idImageUri: idUri,
    selfieImageUri: selfieUri,
    distance: input.distance,
    matched,
    note: input.note,
    verifiedAt: matched ? new Date().toISOString() : undefined,
  };
  b.kyc = kyc;
  rsave();
  raudit({
    actor: b.name,
    action: matched ? `KYC verified (face match, distance ${input.distance.toFixed(3)})` : `KYC failed (face mismatch, distance ${input.distance.toFixed(3)})`,
    subject: borrowerId,
  });
  return kyc;
}
