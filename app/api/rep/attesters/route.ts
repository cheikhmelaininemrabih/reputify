import { NextResponse } from "next/server";
import { onboardAttester } from "@/lib/rep-service";
import { publicAttester } from "@/lib/rep-present";
import { AttesterRegistry } from "@/lib/contracts";
import { PARAMS } from "@/lib/rep-types";

// GET — list attesters (address, accreditation, bond).
export async function GET() {
  return NextResponse.json({ attesters: AttesterRegistry.list().map(publicAttester) });
}

// POST — register + accredit an attester with a bonded stake.
export async function POST(req: Request) {
  try {
    const { name, stake } = (await req.json()) as { name: string; stake?: number };
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const a = onboardAttester({ name, stake: stake ?? PARAMS.minBond });
    return NextResponse.json({ ok: true, attester: publicAttester(a) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
