import { NextResponse } from "next/server";
import { db, save, audit } from "@/lib/db";
import { hashPassword, createSession, newId } from "@/lib/auth";
import { publicAccount } from "@/lib/present";
import type { EarnerProfile, ProviderAccount, ProviderId } from "@/lib/models";

export async function POST(req: Request) {
  const { provider, phone, name, password, profile } = (await req.json()) as {
    provider: ProviderId; phone: string; name: string; password: string; profile?: EarnerProfile;
  };
  if (!provider || !phone || !name || !password) return NextResponse.json({ error: "all fields required" }, { status: 400 });
  if (Object.values(db.providerAccounts).some((a) => a.provider === provider && a.phone === phone))
    return NextResponse.json({ error: "That phone already has an account with this provider" }, { status: 409 });

  const id = newId("pa");
  const { hash, salt } = hashPassword(password);
  // New accounts start empty — no balance, no transactions. The user builds their
  // own history by using the wallet; Reputify later scores only that real activity.
  const acct: ProviderAccount = {
    id, provider, phone, name, passwordHash: hash, salt, profile: profile || "trader",
    createdAt: new Date().toISOString(), balance: 0, txns: [], grants: [],
  };
  db.providerAccounts[id] = acct;
  save();
  audit({ system: provider, actor: name, action: `opened ${provider} account`, subject: id });

  createSession(id, "provider");
  return NextResponse.json({ ok: true, account: publicAccount(acct) });
}
