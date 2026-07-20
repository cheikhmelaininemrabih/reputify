import { NextResponse } from "next/server";
import { DisputeResolver } from "@/lib/contracts";

// GET — all challenges. POST — raise a fraud challenge against a relied-on
// attestation of a defaulted loan. Body: { loanId, attestationSeq, evidenceURI }.
export async function GET() {
  return NextResponse.json({ challenges: DisputeResolver.list() });
}

export async function POST(req: Request) {
  try {
    const { loanId, attestationSeq, evidenceURI } = (await req.json()) as {
      loanId: number; attestationSeq: number; evidenceURI?: string;
    };
    const c = DisputeResolver.raiseChallenge(Number(loanId), Number(attestationSeq), evidenceURI ?? "");
    return NextResponse.json({ ok: true, challenge: c });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
