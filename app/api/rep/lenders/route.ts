import { NextResponse } from "next/server";
import { onboardLender } from "@/lib/rep-service";
import { publicLender } from "@/lib/rep-present";
import { rdb } from "@/lib/rep-db";

// GET — list lender identities.
export async function GET() {
  return NextResponse.json({ lenders: Object.values(rdb.lenders).map(publicLender) });
}

// POST — register a lender identity. Body: { name }.
export async function POST(req: Request) {
  try {
    const { name } = (await req.json()) as { name: string };
    const l = onboardLender(name);
    return NextResponse.json({ ok: true, lender: publicLender(l) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
