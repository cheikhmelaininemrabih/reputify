import { NextResponse } from "next/server";
import { ensureDefaultAttester } from "@/lib/rep-service";
import { mintForBorrower } from "@/lib/minting";

// POST — run the minting job for this borrower (standing consent → attestations).
// Body: { months?, endPeriod? }. The headless accredited attester signs.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json().catch(() => ({}))) as { months?: number; endPeriod?: string; fabricate?: boolean };
    const attester = ensureDefaultAttester();
    const results = await mintForBorrower(attester, params.id, body.months ?? 6, body.endPeriod, !!body.fabricate);
    return NextResponse.json({
      ok: true,
      minted: results.length,
      seqs: results.map((r) => r.attestation.seq),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
