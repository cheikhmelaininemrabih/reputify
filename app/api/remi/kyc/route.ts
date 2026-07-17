import { NextResponse } from "next/server";
import { currentRemiUser } from "@/lib/auth";
import { db, save, audit } from "@/lib/db";
import { runKyc, type KycInput } from "@/lib/kyc";
import { anchor } from "@/lib/ledger";
import { publicUser } from "@/lib/present";

export async function POST(req: Request) {
  const user = currentRemiUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (user.kyc.status === "verified") return NextResponse.json({ error: "Already verified" }, { status: 409 });

  const body = (await req.json()) as Partial<KycInput>;
  const input: KycInput = {
    fullName: body.fullName || user.name,
    nationalId: body.nationalId || "",
    dob: body.dob || "",
    documentType: body.documentType || "nin",
    livenessPassed: body.livenessPassed ?? false,
  };
  const outcome = runKyc(input, user.wallet, db.nullifiers);

  if (!outcome.ok) {
    user.kyc = outcome.record;
    save();
    return NextResponse.json({ error: outcome.error, checks: outcome.checks }, { status: 422 });
  }

  db.nullifiers.push(outcome.record.nullifier!);
  const a = await anchor("kyc", user.wallet.did, outcome.commitment!, user.name);
  outcome.record.anchorTxid = a.txid;
  user.kyc = outcome.record;
  save();
  audit({ system: "remi", actor: user.name, action: "passed KYC — Verifiable Credential anchored", subject: user.id, anchorTxid: a.txid });

  return NextResponse.json({ ok: true, user: publicUser(user), checks: outcome.checks, credential: outcome.credential, kycAnchor: a });
}
