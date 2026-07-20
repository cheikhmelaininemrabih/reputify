import { NextResponse } from "next/server";
import { authorizeConnection } from "@/lib/wallets";

// POST — authorize a pending connection request. Body: { connectionId }.
// This is the ONLY place a connection can move from pending to approved —
// the borrower app can request and can deny, but only a real wallet can say yes.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { connectionId } = (await req.json()) as { connectionId?: string };
    if (!connectionId) return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    const c = authorizeConnection(params.id, connectionId);
    return NextResponse.json({ ok: true, connection: { id: c.id, status: c.status } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
