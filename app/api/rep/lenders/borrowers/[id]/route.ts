import { NextResponse } from "next/server";
import { assembleReputation } from "@/lib/reputation";
import { lenderGranularView } from "@/lib/disclosure";

// GET ?lenderId= — the lender's view of a borrower: always the reputation summary;
// the verified granular packages only if the borrower has allowed disclosure. The
// Verified ✓ badge = every package's re-hash matched its on-chain attestation.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const lenderId = new URL(req.url).searchParams.get("lenderId") ?? "lender";
  const reputation = assembleReputation(params.id);
  if (!reputation) return NextResponse.json({ error: "unknown borrower" }, { status: 404 });
  const view = lenderGranularView(params.id, lenderId);
  const items = [...view.packages, ...view.documents];
  const verified = view.allowed && view.subscribed && items.length > 0 && items.every((p) => p.verified);
  return NextResponse.json({
    reputation,
    granularAllowed: view.allowed,
    subscribed: view.subscribed,
    verified,
    packages: view.packages,
    documents: view.documents,
  });
}
