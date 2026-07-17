import { NextResponse } from "next/server";
import { currentRemiUser } from "@/lib/auth";
import { db, save, audit } from "@/lib/db";
import { issueConsent } from "@/lib/consent";
import { anchor } from "@/lib/ledger";

export async function POST(req: Request) {
  const user = currentRemiUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!user.passportId) return NextResponse.json({ error: "Generate a Passport first" }, { status: 400 });
  const passport = db.passports[user.passportId];
  if (!passport) return NextResponse.json({ error: "passport missing" }, { status: 404 });

  const { audience } = (await req.json()) as { audience: string };
  const consent = issueConsent(user, passport, audience || "bank:launch");
  db.consents[consent.consentId] = consent;
  save();
  audit({ system: "remi", actor: user.wallet.did, action: `granted consent to ${consent.audience}`, subject: consent.consentId });

  const a = await anchor("consent", consent.consentId, consent.commitment, user.name);
  return NextResponse.json({ ok: true, consent, anchor: a });
}
