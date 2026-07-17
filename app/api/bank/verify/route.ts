import { NextResponse } from "next/server";
import { verifyOnChain } from "@/lib/hedera";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const txid = searchParams.get("txid") || "";
  const commitment = searchParams.get("commitment") || "";
  if (!txid || !commitment) return NextResponse.json({ error: "txid and commitment required" }, { status: 400 });

  const anchorRec = db.anchors[txid];
  const result = await verifyOnChain(txid, commitment);
  const localMatch = anchorRec ? anchorRec.commitment.toLowerCase() === commitment.toLowerCase() : false;

  return NextResponse.json({
    txid, commitment,
    broadcast: anchorRec?.broadcast ?? result.broadcast,
    verified: result.found || localMatch,
    detail: result.found ? result.detail : localMatch ? "Simulated anchor — commitment matches the Reputify ledger record." : result.detail,
    explorerUrl: anchorRec?.explorerUrl,
  });
}
