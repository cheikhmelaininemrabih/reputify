import { NextResponse } from "next/server";
import { currentRemiUser } from "@/lib/auth";
import { db, save, audit } from "@/lib/db";
import { revokeConsentBody } from "@/lib/consent";
import { anchor } from "@/lib/ledger";

// Borrower-initiated revocation. A bank's next query/verify against this
// consentId is rejected (isConsentValid checks `revoked`) — enforced at the
// single choke point both /api/bank/query and /api/bank/applicants read.
export async function POST(req: Request) {
  const user = currentRemiUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { consentId } = (await req.json()) as { consentId: string };
  const consent = db.consents[consentId];
  if (!consent) return NextResponse.json({ error: "unknown consent" }, { status: 404 });
  if (consent.did !== user.wallet.did) return NextResponse.json({ error: "not your consent" }, { status: 403 });
  if (consent.revoked) return NextResponse.json({ error: "already revoked" }, { status: 400 });

  const { revokedAt, commitment } = revokeConsentBody(consent);
  consent.revoked = true;
  consent.revokedAt = revokedAt;
  consent.revocationCommitment = commitment;
  save();
  audit({ system: "remi", actor: user.wallet.did, action: `revoked consent to ${consent.audience}`, subject: consent.consentId });

  const a = await anchor("consent", consent.consentId, commitment, user.name);
  return NextResponse.json({ ok: true, consent, anchor: a });
}
