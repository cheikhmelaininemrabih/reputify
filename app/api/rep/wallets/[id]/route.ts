import { NextResponse } from "next/server";
import { publicWallet } from "@/lib/rep-present";
import { rdb } from "@/lib/rep-db";

// GET — one wallet's balance + transaction ledger.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const w = rdb.wallets[params.id];
  if (!w) return NextResponse.json({ error: "unknown wallet" }, { status: 404 });
  return NextResponse.json({ wallet: publicWallet(w) });
}
