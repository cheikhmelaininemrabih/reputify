import { NextResponse } from "next/server";
import { decideDisclosure } from "@/lib/disclosure";

// POST — the borrower approves/denies a request. Body: { allow: boolean }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { allow } = (await req.json()) as { allow: boolean };
    const d = decideDisclosure(params.id, !!allow);
    return NextResponse.json({ ok: true, disclosure: { id: d.id, state: d.state } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
