import { NextResponse } from "next/server";
import { readSession, writeSession, clearSessionCookie } from "@/lib/session";
import { rdb } from "@/lib/rep-db";
import type { Role } from "@/lib/session";

// GET — the current signed-in identity, if any.
export async function GET() {
  return NextResponse.json({ session: readSession() });
}

// POST { role, id } — sign in as one identity. Validated against the real
// store (can't sign in as an id that doesn't exist) and overwrites whatever
// role was previously active — a browser only ever holds one at a time.
export async function POST(req: Request) {
  const { role, id } = (await req.json().catch(() => ({}))) as { role?: Role; id?: string };
  if (!role || !id) return NextResponse.json({ error: "role and id are required" }, { status: 400 });
  const name =
    role === "borrower" ? rdb.borrowers[id]?.name :
    role === "lender" ? rdb.lenders[id]?.name :
    role === "attester" ? rdb.attesters[id]?.name :
    undefined;
  if (!name) return NextResponse.json({ error: role === "borrower" || role === "lender" || role === "attester" ? "unknown identity" : "unknown role" }, { status: 404 });
  writeSession({ role, id, name });
  return NextResponse.json({ ok: true, session: { role, id, name } });
}

// DELETE — sign out.
export async function DELETE() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
