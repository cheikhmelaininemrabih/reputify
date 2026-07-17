import { NextResponse } from "next/server";
import { currentRemiUser } from "@/lib/auth";
import { db, save, audit } from "@/lib/db";
import { buildPassport } from "@/lib/passport";
import { analyzeFraud } from "@/lib/fraud-ai";
import { pullLinkedTxns, anchor } from "@/lib/ledger";

export async function POST() {
  const user = currentRemiUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (user.kyc.status !== "verified") return NextResponse.json({ error: "Complete KYC before generating a Passport" }, { status: 403 });

  const { txns, sources } = pullLinkedTxns(user);
  if (txns.length === 0) return NextResponse.json({ error: "Link a mobile-money account first" }, { status: 400 });

  // AI fraud/risk verdict (OpenAI when configured, heuristic fallback) drives the passport.
  const aiRisk = await analyzeFraud(txns);
  const passport = buildPassport(user, txns, aiRisk);
  db.passports[passport.passportId] = passport;
  user.passportId = passport.passportId;
  save();

  const a = await anchor("passport", passport.passportId, passport.commitment, user.name);
  audit({ system: "remi", actor: user.name, action: `minted Credit Passport from ${sources.length} linked account(s) — risk analyzed by ${aiRisk.source === "openai" ? "AI" : "rules"}`, subject: passport.passportId, anchorTxid: a.txid });

  return NextResponse.json({
    ok: true,
    passport: { score: passport.score, commitment: passport.commitment, features: passport.features, issuedAt: passport.issuedAt, aiRisk: passport.aiRisk },
    anchor: a,
    sources,
  });
}
