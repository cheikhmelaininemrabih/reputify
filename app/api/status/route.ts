import { NextResponse } from "next/server";
import { hederaStatus } from "@/lib/hedera";
import { db } from "@/lib/db";

export async function GET() {
  const h = hederaStatus();
  return NextResponse.json({
    network: h.network, // "testnet" | "mainnet"
    mode: h.mode, // "live" | "simulated"
    live: h.live,
    operatorId: h.operatorId,
    topicId: h.topicId,
    counts: {
      users: Object.keys(db.users).length,
      providerAccounts: Object.keys(db.providerAccounts).length,
      banks: Object.keys(db.bankUsers).length,
      passports: Object.keys(db.passports).length,
      anchors: Object.keys(db.anchors).length,
    },
    audit: db.audit.slice(0, 15),
  });
}
