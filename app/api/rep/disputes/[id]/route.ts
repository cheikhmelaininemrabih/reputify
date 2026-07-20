import { NextResponse } from "next/server";
import { DisputeResolver } from "@/lib/contracts";

// POST — the arbiter rules on a challenge. Body: { upheld: boolean }.
// Uphold ⇒ slash the attester and compensate the lender. Honest default ⇒ no slash.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { upheld } = (await req.json()) as { upheld: boolean };
    const c = DisputeResolver.rule(Number(params.id), !!upheld);
    return NextResponse.json({ ok: true, challenge: c });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
