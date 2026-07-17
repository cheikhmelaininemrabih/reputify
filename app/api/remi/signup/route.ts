import { NextResponse } from "next/server";
import { db, save, audit } from "@/lib/db";
import { hashPassword, createSession, newId } from "@/lib/auth";
import { createWallet, didCommitment } from "@/lib/wallet";
import { anchor } from "@/lib/ledger";
import { publicUser } from "@/lib/present";
import type { RemiUser } from "@/lib/models";

export async function POST(req: Request) {
  const { phone, name, password } = (await req.json()) as { phone: string; name: string; password: string };
  if (!phone || !name || !password) return NextResponse.json({ error: "phone, name and password are required" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  if (Object.values(db.users).some((u) => u.phone === phone)) return NextResponse.json({ error: "An account with that phone already exists" }, { status: 409 });

  const { hash, salt } = hashPassword(password);
  const wallet = createWallet();
  const user: RemiUser = {
    id: newId("usr"),
    phone, name,
    passwordHash: hash, salt,
    createdAt: new Date().toISOString(),
    wallet,
    kyc: { status: "none" },
    linked: [],
  };
  db.users[user.id] = user;
  audit({ system: "remi", actor: name, action: "created Reputify account + Hedera wallet", subject: user.id });

  // Anchor the DID document hash on-chain — the user's tamper-evident identity.
  const a = await anchor("did", user.wallet.did, didCommitment(wallet), name);
  user.didAnchorTxid = a.txid;
  save();

  createSession(user.id, "remi");
  return NextResponse.json({ ok: true, user: publicUser(user), didAnchor: a });
}
