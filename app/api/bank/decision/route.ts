import { NextResponse } from "next/server";
import { currentBankUser } from "@/lib/auth";
import { db, save, audit } from "@/lib/db";
import { isConsentValid } from "@/lib/consent";

export async function POST(req: Request) {
  const bank = currentBankUser();
  if (!bank) return NextResponse.json({ error: "sign in" }, { status: 401 });

  const { consentId, decision, amount } = (await req.json()) as { consentId: string; decision: "approved" | "declined"; amount?: number };
  const consent = db.consents[consentId];
  if (!consent) return NextResponse.json({ error: "unknown applicant" }, { status: 404 });
  const check = isConsentValid(consent, "bank:launch");
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 403 });

  db.decisions[consentId] = {
    consentId,
    passportId: consent.passportId,
    bankId: bank.id,
    decision,
    amount: decision === "approved" ? Math.max(0, Math.round(Number(amount) || 0)) : 0,
    decidedAt: new Date().toISOString(),
  };
  save();
  audit({ system: "bank", actor: bank.bankName, action: `${decision} loan for ${consent.did.slice(0, 22)}…${decision === "approved" ? ` (₦${db.decisions[consentId].amount.toLocaleString()})` : ""}`, subject: consent.passportId });
  return NextResponse.json({ ok: true, decision: db.decisions[consentId] });
}
