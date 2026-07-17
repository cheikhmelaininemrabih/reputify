import { NextResponse } from "next/server";
import { currentProviderAccount } from "@/lib/auth";
import { db } from "@/lib/db";

// The list of other wallets you can send money to (across all providers).
export async function GET() {
  const me = currentProviderAccount();
  const list = Object.values(db.providerAccounts)
    .filter((a) => a.id !== me?.id)
    .map((a) => ({ id: a.id, name: a.name, provider: a.provider, handle: mask(a.phone) }));
  return NextResponse.json({ recipients: list });
}

function mask(p: string) {
  return p.length > 6 ? `${p.slice(0, 5)}•••${p.slice(-3)}` : p;
}
