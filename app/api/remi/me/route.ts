import { NextResponse } from "next/server";
import { currentRemiUser } from "@/lib/auth";
import { db, anchorsForSubject } from "@/lib/db";
import { pullLinkedTxns } from "@/lib/ledger";
import { publicUser } from "@/lib/present";

export async function GET() {
  const user = currentRemiUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { sources } = pullLinkedTxns(user);
  const passport = user.passportId ? db.passports[user.passportId] : undefined;
  const consents = user.passportId
    ? Object.values(db.consents).filter((c) => c.passportId === user.passportId).sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))
    : [];

  // On-chain identity ledger: every anchor tied to this user (DID, KYC, passport, consents).
  const ledger = [
    ...anchorsForSubject(user.wallet.did),
    ...(user.passportId ? anchorsForSubject(user.passportId) : []),
    ...Object.values(db.consents).filter((c) => c.passportId === user.passportId).flatMap((c) => anchorsForSubject(c.consentId)),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({
    user: publicUser(user),
    sources,
    passport: passport ? { score: passport.score, commitment: passport.commitment, features: passport.features, issuedAt: passport.issuedAt, aiRisk: passport.aiRisk } : null,
    consents,
    ledger,
  });
}
