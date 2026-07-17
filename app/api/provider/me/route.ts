import { NextResponse } from "next/server";
import { currentProviderAccount } from "@/lib/auth";
import { publicAccount } from "@/lib/present";

export async function GET() {
  const acct = currentProviderAccount();
  if (!acct) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  return NextResponse.json({ account: publicAccount(acct) });
}
