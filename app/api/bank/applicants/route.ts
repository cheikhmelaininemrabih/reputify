import { NextResponse } from "next/server";
import { currentBankUser } from "@/lib/auth";
import { db, latestAnchor } from "@/lib/db";
import { isConsentValid } from "@/lib/consent";

const AUDIENCE = "bank:launch";
const MULT: Record<string, number> = { "Low risk": 3, "Medium risk": 1.5, "High risk": 0.5 };

// Everyone who granted this bank consent, with the Reputify score the bank uses to
// decide. The bank makes the call — Reputify only supplies the assessment.
export async function GET() {
  const bank = currentBankUser();
  if (!bank) return NextResponse.json({ error: "sign in" }, { status: 401 });

  const rows = Object.values(db.consents)
    // Consent is time-boxed: once it expires the bank loses access to the score.
    // Already-decided applicants stay visible so the lending record/totals survive.
    .filter((c) => c.audience === AUDIENCE && (isConsentValid(c, AUDIENCE).ok || db.decisions[c.consentId]))
    .map((c) => {
      const p = db.passports[c.passportId];
      if (!p) return null;
      const decision = db.decisions[c.consentId];
      const suggested = Math.round((p.features.monthlyInflow * (MULT[p.score.band] ?? 1)) / 1000) * 1000;
      return {
        consentId: c.consentId,
        passportId: p.passportId,
        did: p.did,
        name: db.users[p.passportId.replace(/^pp_/, "")]?.name ?? "Applicant",
        score: p.score.score,
        band: p.score.band,
        pd: p.score.pd,
        reasons: p.score.reasons,
        fraud: p.features.fraud.circularLoopDetected,
        gamblingExposure: p.features.gamblingExposure,
        monthlyInflow: p.features.monthlyInflow,
        suggestedAmount: suggested,
        anchorTxid: latestAnchor(p.passportId)?.txid ?? null,
        commitment: p.commitment,
        decision: decision ? { decision: decision.decision, amount: decision.amount, decidedAt: decision.decidedAt } : null,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score);

  const decided = rows.filter((r: any) => r.decision);
  const approved = decided.filter((r: any) => r.decision.decision === "approved");
  const summary = {
    applicants: rows.length,
    pending: rows.length - decided.length,
    approved: approved.length,
    declined: decided.length - approved.length,
    totalLent: approved.reduce((s: number, r: any) => s + r.decision.amount, 0),
    avgScore: rows.length ? Math.round(rows.reduce((s: number, r: any) => s + r.score, 0) / rows.length) : 0,
  };
  return NextResponse.json({ bank: { bankName: bank.bankName }, summary, applicants: rows });
}
