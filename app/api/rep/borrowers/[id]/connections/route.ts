import { NextResponse } from "next/server";
import { connectProvider, revokeConnection } from "@/lib/rep-service";
import { rdb } from "@/lib/rep-db";

// GET — a borrower's connected providers (standing consent surface).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const conns = Object.values(rdb.connections).filter((c) => c.borrowerId === params.id);
  return NextResponse.json({
    connections: conns.map((c) => ({
      id: c.id, provider: c.provider, scope: c.scope, connectedAt: c.connectedAt, revoked: !!c.revoked,
    })),
  });
}

// POST — connect a provider (mock OAuth), or revoke one.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { provider?: "OPay" | "Moniepoint" | "PalmPay"; revoke?: string };
    if (body.revoke) {
      const c = revokeConnection(body.revoke);
      return NextResponse.json({ ok: true, revoked: c.id });
    }
    if (!body.provider) return NextResponse.json({ error: "provider is required" }, { status: 400 });
    const c = connectProvider(params.id, body.provider);
    return NextResponse.json({ ok: true, connection: { id: c.id, provider: c.provider, connectedAt: c.connectedAt } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
