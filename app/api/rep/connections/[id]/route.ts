import { NextResponse } from "next/server";
import { decideConnection } from "@/lib/rep-service";
import { rdb } from "@/lib/rep-db";

// GET — the public-safe details of one connection request, for a wallet to
// review before authorizing (or a borrower to check status of). No tokens.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const c = rdb.connections[params.id];
  if (!c) return NextResponse.json({ error: "unknown connection" }, { status: 404 });
  const borrower = rdb.borrowers[c.borrowerId];
  return NextResponse.json({
    connection: {
      id: c.id, provider: c.provider, scope: c.scope, status: c.status,
      borrowerName: borrower?.name ?? "A Reputify borrower",
    },
  });
}

// POST { deny: true } — decline from inside the wallet, same as declining
// from the borrower app. Approving lives only at /api/rep/wallets/[id]/authorize.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { deny } = (await req.json().catch(() => ({}))) as { deny?: boolean };
    if (!deny) return NextResponse.json({ error: "only { deny: true } is accepted here" }, { status: 400 });
    const c = decideConnection(params.id, false);
    return NextResponse.json({ ok: true, connection: { id: c.id, status: c.status } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
