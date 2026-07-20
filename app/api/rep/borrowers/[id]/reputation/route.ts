import { NextResponse } from "next/server";
import { assembleReputation } from "@/lib/reputation";
import { pendingDisclosuresForBorrower } from "@/lib/disclosure";
import { rdb } from "@/lib/rep-db";

// GET — the borrower's plain-language standing + any pending lender requests.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rep = assembleReputation(params.id);
  if (!rep) return NextResponse.json({ error: "unknown borrower" }, { status: 404 });
  const requests = pendingDisclosuresForBorrower(params.id).map((d) => ({
    id: d.id, lenderId: d.lenderId, lenderName: rdb.lenders[d.lenderId]?.name ?? d.lenderId, requestedAt: d.requestedAt,
  }));
  return NextResponse.json({ reputation: rep, requests });
}
