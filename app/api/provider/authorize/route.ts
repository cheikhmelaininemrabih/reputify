import { NextResponse } from "next/server";
import { currentProviderAccount } from "@/lib/auth";
import { save, audit } from "@/lib/db";
import { newId } from "@/lib/auth";

// The account holder authorizes an external app (Reputify) to read their history.
// This mints a scoped access grant — the OAuth-style token Reputify uses to pull data.
export async function POST(req: Request) {
  const acct = currentProviderAccount();
  if (!acct) return NextResponse.json({ error: "sign in to your provider account first" }, { status: 401 });
  const { audience } = (await req.json()) as { audience: string };

  const token = newId("grant");
  const scope = ["transactions:read", "balance:read"];
  acct.grants.push({ token, audience: audience || "remi", issuedAt: new Date().toISOString(), scope });
  save();
  audit({ system: acct.provider, actor: acct.name, action: `authorized ${audience || "Reputify"} to read transaction history`, subject: acct.id });

  return NextResponse.json({
    ok: true,
    grant: { token, provider: acct.provider, providerAccountId: acct.id, handle: maskPhone(acct.phone), scope },
  });
}

function maskPhone(p: string) {
  return p.length > 5 ? `${p.slice(0, 4)}•••${p.slice(-4)}` : p;
}
