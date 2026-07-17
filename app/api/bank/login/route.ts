import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = (await req.json()) as { username: string; password: string };
  const bank = Object.values(db.bankUsers).find((b) => b.username === username);
  if (!bank || !verifyPassword(password, bank.passwordHash, bank.salt)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  createSession(bank.id, "bank");
  return NextResponse.json({ ok: true, bank: { id: bank.id, bankName: bank.bankName, username: bank.username } });
}
