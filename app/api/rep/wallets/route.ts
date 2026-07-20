import { NextResponse } from "next/server";
import { onboardWallet } from "@/lib/wallets";
import { publicWallet } from "@/lib/rep-present";
import { rdb } from "@/lib/rep-db";

// GET — list wallet accounts (own app, nothing to do with being a borrower).
export async function GET() {
  return NextResponse.json({ wallets: Object.values(rdb.wallets).map(publicWallet) });
}

// POST — open a wallet. Body: { provider, phone, name }.
export async function POST(req: Request) {
  try {
    const { provider, phone, name } = (await req.json()) as { provider: any; phone: string; name: string };
    const w = onboardWallet({ provider, phone, name });
    return NextResponse.json({ ok: true, wallet: publicWallet(w) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
