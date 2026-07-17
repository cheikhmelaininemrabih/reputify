import { NextResponse } from "next/server";
import { currentBankUser } from "@/lib/auth";
import { seedApplicants } from "@/lib/seed";

// Populate the bank's review pool with synthetic applicants (for the demo).
export async function POST(req: Request) {
  const bank = currentBankUser();
  if (!bank) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const { count } = (await req.json().catch(() => ({}))) as { count?: number };
  const n = Math.min(Math.max(Number(count) || 12, 1), 30);
  const created = await seedApplicants("bank:launch", n);
  return NextResponse.json({ ok: true, created });
}
