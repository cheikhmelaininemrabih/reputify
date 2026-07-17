import { NextResponse } from "next/server";
import { currentRemiUser } from "@/lib/auth";
import { db, save, audit } from "@/lib/db";
import type { ProviderId } from "@/lib/models";
import { publicUser } from "@/lib/present";

// Reputify redeems the grant token from the provider and records the link.
export async function POST(req: Request) {
  const user = currentRemiUser();
  if (!user) return NextResponse.json({ error: "not signed in to Reputify" }, { status: 401 });
  const { provider, providerAccountId, grantToken, handle } = (await req.json()) as {
    provider: ProviderId; providerAccountId: string; grantToken: string; handle: string;
  };

  const acct = db.providerAccounts[providerAccountId];
  const grant = acct?.grants.find((g) => g.token === grantToken);
  if (!acct || !grant) return NextResponse.json({ error: "invalid or expired authorization" }, { status: 403 });

  // Replace any existing link to the same provider.
  user.linked = user.linked.filter((l) => l.provider !== provider);
  user.linked.push({ provider, providerAccountId, accessToken: grantToken, handle: handle || acct.phone, linkedAt: new Date().toISOString() });
  save();
  audit({ system: "remi", actor: user.name, action: `linked ${provider} account via consented grant`, subject: user.id });

  return NextResponse.json({ ok: true, user: publicUser(user) });
}
