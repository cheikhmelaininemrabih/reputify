import { NextResponse } from "next/server";
import { currentBankUser } from "@/lib/auth";

export async function GET() {
  const bank = currentBankUser();
  if (!bank) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  return NextResponse.json({ bank: { id: bank.id, bankName: bank.bankName, username: bank.username } });
}
