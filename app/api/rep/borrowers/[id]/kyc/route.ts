import { NextResponse } from "next/server";
import { submitKyc } from "@/lib/kyc";
import { rdb } from "@/lib/rep-db";

// GET — current KYC status (no images, no raw biometric distance beyond the record).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const b = rdb.borrowers[params.id];
  if (!b) return NextResponse.json({ error: "unknown borrower" }, { status: 404 });
  const { status, distance, matched, verifiedAt } = b.kyc;
  return NextResponse.json({ kyc: { status, distance, matched, verifiedAt } });
}

// POST — submit the captured ID photo + selfie and the client-computed face
// comparison. Body: { idImageBase64, selfieImageBase64, distance, note? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { idImageBase64?: string; selfieImageBase64?: string; distance?: number; note?: string };
    if (!body.idImageBase64 || !body.selfieImageBase64 || typeof body.distance !== "number") {
      return NextResponse.json({ error: "idImageBase64, selfieImageBase64 and distance are required" }, { status: 400 });
    }
    const kyc = submitKyc(params.id, {
      idImageBase64: body.idImageBase64, selfieImageBase64: body.selfieImageBase64,
      distance: body.distance, note: body.note,
    });
    return NextResponse.json({ ok: true, kyc: { status: kyc.status, distance: kyc.distance, matched: kyc.matched, verifiedAt: kyc.verifiedAt } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
