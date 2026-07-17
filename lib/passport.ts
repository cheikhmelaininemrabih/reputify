// Assemble a Credit Passport for a Reputify user from the transactions pulled from
// their linked mobile-money accounts. Score, commit, bind to the user's DID and
// KYC nullifier. An optional AI fraud verdict (from lib/fraud-ai) drives the fraud
// signal that feeds the score — so it is baked into the anchored commitment.
import type { AiRiskVerdict, CreditPassport } from "./types";
import type { ProviderTxn, RemiUser } from "./models";
import { extractFeatures } from "./features";
import { scoreFeatures } from "./scoring";
import { commit } from "./crypto";

export function buildPassport(user: RemiUser, txns: ProviderTxn[], aiRisk?: AiRiskVerdict): CreditPassport {
  const features = extractFeatures(txns);
  if (aiRisk) {
    // The verdict drives the fraud signal the scoring model reads.
    features.fraud = {
      circularLoopDetected: aiRisk.circularLoopDetected,
      loopValueShare: aiRisk.loopValueShare,
      loopMembers: features.fraud.loopMembers,
      note: aiRisk.narrative || features.fraud.note,
    };
  }
  const score = scoreFeatures(features);
  const did = user.wallet.did;
  const passportId = `pp_${user.id}`;

  const body = {
    version: 1 as const,
    passportId,
    did,
    score: { pd: score.pd, score: score.score, band: score.band },
    reasons: score.reasons.map((r) => ({ code: r.code, direction: r.direction })),
    featureDigest: commit(features),
    kycNullifier: user.kyc.nullifier ?? null,
  };
  const commitment = commit(body);

  return {
    version: 1,
    passportId,
    did,
    issuedAt: new Date().toISOString(),
    score,
    features,
    commitment,
    sybilNullifier: user.kyc.nullifier ?? "",
    aiRisk,
  };
}
