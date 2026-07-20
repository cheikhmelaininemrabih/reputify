import { NextResponse } from "next/server";
import { LoanRegistry } from "@/lib/contracts";

// GET — all loans. POST — a lender issues a loan (records reliedOn attestation seqs).
export async function GET() {
  return NextResponse.json({ loans: LoanRegistry.list() });
}

export async function POST(req: Request) {
  try {
    const { lender, borrower, principal, dueAt, reliedOn } = (await req.json()) as {
      lender: string; borrower: string; principal: number; dueAt: string; reliedOn: number[];
    };
    if (!lender || !borrower || !principal || !dueAt) {
      return NextResponse.json({ error: "lender, borrower, principal and dueAt are required" }, { status: 400 });
    }
    const loan = LoanRegistry.issueLoan(lender, borrower, principal, dueAt, reliedOn ?? []);
    return NextResponse.json({ ok: true, loan });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
