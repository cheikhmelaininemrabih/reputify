import { NextResponse } from "next/server";
import { requestDisclosure, pendingDisclosuresForBorrower } from "@/lib/disclosure";

// GET ?borrowerId= — pending disclosure requests for a borrower.
export async function GET(req: Request) {
  const borrowerId = new URL(req.url).searchParams.get("borrowerId");
  if (!borrowerId) return NextResponse.json({ error: "borrowerId is required" }, { status: 400 });
  return NextResponse.json({ requests: pendingDisclosuresForBorrower(borrowerId) });
}

// POST — a lender requests granular access to a borrower's packages.
export async function POST(req: Request) {
  try {
    const { borrowerId, lenderId } = (await req.json()) as { borrowerId: string; lenderId: string };
    if (!borrowerId || !lenderId) return NextResponse.json({ error: "borrowerId and lenderId are required" }, { status: 400 });
    const d = requestDisclosure(borrowerId, lenderId);
    return NextResponse.json({ ok: true, disclosure: { id: d.id, state: d.state } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
