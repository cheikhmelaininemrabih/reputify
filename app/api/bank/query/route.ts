import { NextResponse } from "next/server";
import { currentBankUser } from "@/lib/auth";
import { isConsentValid } from "@/lib/consent";
import { db, audit, latestAnchor } from "@/lib/db";
import type { Attestation } from "@/lib/types";

// Authenticated bank endpoint. Present a consentId → receive an ATTESTATION
// (score, band, reason codes, fraud flag, on-chain commitment). Never the raw
// feed or the underlying features.
export async function POST(req: Request) {
  const bank = currentBankUser();
  if (!bank) return NextResponse.json({ error: "sign in to the bank console" }, { status: 401 });

  const { consentId } = (await req.json()) as { consentId: string };
  const consent = db.consents[consentId];
  if (!consent) return NextResponse.json({ error: "unknown or unissued consent" }, { status: 404 });

  const check = isConsentValid(consent, "bank:launch");
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 403 });

  const passport = db.passports[consent.passportId];
  if (!passport) return NextResponse.json({ error: "passport not found" }, { status: 404 });

  const passportAnchor = latestAnchor(passport.passportId);
  const attestation: Attestation = {
    passportId: passport.passportId,
    did: passport.did,
    score: passport.score.score,
    band: passport.score.band,
    reasons: consent.scope.includes("reasons") ? passport.score.reasons : [],
    fraudChecked: true,
    issuedAt: new Date().toISOString(),
    commitment: passport.commitment,
    passportAnchor,
    consentId: consent.consentId,
    consentValidUntil: consent.expiresAt,
  };

  audit({ system: "bank", actor: bank.bankName, action: "queried Passport under consent (received attestation, not raw data)", subject: passport.passportId, anchorTxid: passportAnchor?.txid });
  return NextResponse.json({ attestation });
}
