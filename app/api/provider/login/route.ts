import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { publicAccount } from "@/lib/present";
import type { ProviderId } from "@/lib/models";

export async function POST(req: Request) {
  const { provider, phone, password } = (await req.json()) as { provider: ProviderId; phone: string; password: string };
  const acct = Object.values(db.providerAccounts).find((a) => a.provider === provider && a.phone === phone);
  if (!acct || !verifyPassword(password, acct.passwordHash, acct.salt)) {
    return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
  }
  createSession(acct.id, "provider");
  return NextResponse.json({ ok: true, account: publicAccount(acct) });
}
