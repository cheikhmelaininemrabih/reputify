import { NextResponse } from "next/server";
import { connectProvider, decideConnection, revokeConnection } from "@/lib/rep-service";
import { rdb } from "@/lib/rep-db";

// GET — a borrower's connection requests (pending/approved/denied) + active links.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const conns = Object.values(rdb.connections).filter((c) => c.borrowerId === params.id);
  return NextResponse.json({
    connections: conns.map((c) => ({
      id: c.id, provider: c.provider, scope: c.scope, status: c.status,
      connectedAt: c.connectedAt, decidedAt: c.decidedAt, revoked: !!c.revoked,
    })),
  });
}

// POST — start connecting a provider (mock OAuth, creates a pending request),
// deny a pending request, or revoke an already-approved one. Approving is
// deliberately NOT available here — that only happens inside the matching
// wallet app (POST /api/rep/wallets/[id]/authorize), the same way you'd
// approve a third-party app from inside your own bank, not from inside the
// app asking for access.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as {
      provider?: "OPay" | "Moniepoint" | "PalmPay"; revoke?: string; decide?: string; approve?: boolean;
    };
    if (body.decide) {
      if (body.approve) {
        return NextResponse.json({ error: "approving a connection must be done from inside the matching wallet, not the borrower app" }, { status: 400 });
      }
      const c = decideConnection(body.decide, false);
      return NextResponse.json({ ok: true, connection: { id: c.id, status: c.status } });
    }
    if (body.revoke) {
      const c = revokeConnection(body.revoke);
      return NextResponse.json({ ok: true, revoked: c.id });
    }
    if (!body.provider) return NextResponse.json({ error: "provider is required" }, { status: 400 });
    const c = connectProvider(params.id, body.provider);
    return NextResponse.json({ ok: true, connection: { id: c.id, provider: c.provider, scope: c.scope, status: c.status } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
