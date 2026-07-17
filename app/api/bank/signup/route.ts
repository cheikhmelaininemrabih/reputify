import { NextResponse } from "next/server";
import { db, save, audit } from "@/lib/db";
import { hashPassword, createSession, newId } from "@/lib/auth";
import type { BankUser } from "@/lib/models";

export async function POST(req: Request) {
  const { bankName, username, password } = (await req.json()) as { bankName: string; username: string; password: string };
  if (!bankName || !username || !password) return NextResponse.json({ error: "all fields required" }, { status: 400 });
  if (Object.values(db.bankUsers).some((b) => b.username === username)) return NextResponse.json({ error: "username taken" }, { status: 409 });

  const { hash, salt } = hashPassword(password);
  const bank: BankUser = { id: newId("bank"), bankName, username, passwordHash: hash, salt, createdAt: new Date().toISOString() };
  db.bankUsers[bank.id] = bank;
  save();
  audit({ system: "bank", actor: bankName, action: "registered bank console user", subject: bank.id });
  createSession(bank.id, "bank");
  return NextResponse.json({ ok: true, bank: { id: bank.id, bankName, username } });
}
