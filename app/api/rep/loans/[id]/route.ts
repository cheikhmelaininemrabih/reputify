import { NextResponse } from "next/server";
import { LoanRegistry } from "@/lib/contracts";

// POST — the lender updates loan state. Body: { action: "repaid"|"defaulted", by }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { action, by } = (await req.json()) as { action: "repaid" | "defaulted"; by: string };
    const loanId = Number(params.id);
    if (!by) return NextResponse.json({ error: "by (lender) is required" }, { status: 400 });
    const loan = action === "repaid"
      ? LoanRegistry.markRepaid(loanId, by)
      : action === "defaulted"
        ? LoanRegistry.markDefaulted(loanId, by)
        : null;
    if (!loan) return NextResponse.json({ error: "action must be 'repaid' or 'defaulted'" }, { status: 400 });
    return NextResponse.json({ ok: true, loan });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
