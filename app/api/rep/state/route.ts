import { NextResponse } from "next/server";
import { rdb, _resetRepDb } from "@/lib/rep-db";
import { attestationMode } from "@/lib/attestation";
import { publicAttester, publicBorrower } from "@/lib/rep-present";

// GET — a snapshot for the demo dashboards (no private keys, no raw figures).
export async function GET() {
  return NextResponse.json({
    mode: attestationMode(),
    borrowers: Object.values(rdb.borrowers).map(publicBorrower),
    attesters: Object.values(rdb.attesters).map(publicAttester),
    loans: Object.values(rdb.loans),
    challenges: Object.values(rdb.challenges),
    attestations: Object.keys(rdb.attestations).length,
    audit: rdb.audit.slice(0, 40),
  });
}

// POST { reset: true } — wipe the roadmap-system store (demo convenience only).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { reset?: boolean };
  if (body.reset) {
    _resetRepDb();
    return NextResponse.json({ ok: true, reset: true });
  }
  return NextResponse.json({ error: "nothing to do" }, { status: 400 });
}
