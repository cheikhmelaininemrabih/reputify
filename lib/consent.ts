// Issue a scoped, time-boxed, borrower-signed consent receipt. Signed with the
// user's own Hedera identity key; the receipt hash is anchored on-chain for
// non-repudiation. Banks present the consentId and receive attestations only.
import type { ConsentReceipt, CreditPassport } from "./types";
import type { RemiUser } from "./models";
import { commit } from "./crypto";
import { signWithWallet } from "./wallet";

const DEFAULT_TTL_MIN = 60 * 24 * 7; // 7 days — long enough for a lending review cycle

export function issueConsent(
  user: RemiUser,
  passport: CreditPassport,
  audience: string,
  scope: string[] = ["score", "band", "reasons", "fraudChecked"],
  ttlMinutes = DEFAULT_TTL_MIN
): ConsentReceipt {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlMinutes * 60000);
  const consentId = `cn_${user.id}_${issuedAt.getTime().toString(36)}`;

  const body = {
    version: 1 as const,
    consentId,
    passportId: passport.passportId,
    did: passport.did,
    audience,
    scope,
    purpose: "Credit assessment for a financing application",
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const signature = signWithWallet(user.wallet, JSON.stringify(body));
  const commitment = commit({ ...body, signature });

  return { ...body, signature, commitment };
}

export function isConsentValid(c: ConsentReceipt, audience: string): { ok: boolean; reason?: string } {
  if (c.audience !== audience) return { ok: false, reason: "Consent was issued for a different institution." };
  if (new Date(c.expiresAt).getTime() < Date.now()) return { ok: false, reason: "Consent has expired." };
  return { ok: true };
}
