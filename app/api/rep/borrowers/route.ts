import { NextResponse } from "next/server";
import { onboardBorrower } from "@/lib/rep-service";
import { publicBorrower } from "@/lib/rep-present";
import { rdb } from "@/lib/rep-db";

// POST — onboard a borrower (custodial wallet + anti-Sybil personhood binding).
export async function POST(req: Request) {
  try {
    const { name, phone, personhoodId } = (await req.json()) as {
      name: string; phone: string; personhoodId: string;
    };
    const b = onboardBorrower({ name, phone, personhoodId });
    return NextResponse.json({ ok: true, borrower: publicBorrower(b) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// GET — list borrowers (public fields only).
export async function GET() {
  return NextResponse.json({ borrowers: Object.values(rdb.borrowers).map(publicBorrower) });
}
