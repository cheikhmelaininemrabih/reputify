import { NextResponse } from "next/server";
import { currentProviderAccount, newId } from "@/lib/auth";
import { db, save, audit } from "@/lib/db";
import { publicAccount } from "@/lib/present";
import { analyzeRisk } from "@/lib/fraud";
import { BILLERS, CATEGORY_CHANNEL } from "@/lib/billers";
import type { ProviderAccount, ProviderTxn } from "@/lib/models";

function addTxn(acct: ProviderAccount, channel: string, amount: number, counterparty: string): ProviderTxn {
  acct.balance = Math.max(0, acct.balance + amount);
  const t: ProviderTxn = { id: newId("tx"), ts: new Date().toISOString(), channel, amount, counterparty, balanceAfter: acct.balance };
  acct.txns.push(t);
  return t;
}
const mask = (p: string) => (p.length > 6 ? `${p.slice(0, 5)}•••${p.slice(-3)}` : p);

export async function POST(req: Request) {
  const acct = currentProviderAccount();
  if (!acct) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const { action, amount, recipientId, biller } = (await req.json()) as {
    action: string; amount: number; recipientId?: string; biller?: string;
  };
  const amt = Math.round(Number(amount));
  if (!amt || amt <= 0) return NextResponse.json({ error: "Enter an amount greater than zero" }, { status: 400 });

  if (action === "recharge") {
    addTxn(acct, "cash_in", amt, "Cash deposit");
    audit({ system: acct.provider, actor: acct.name, action: `recharged +₦${amt.toLocaleString()}`, subject: acct.id });
  } else if (action === "salary") {
    addTxn(acct, "salary", amt, "Employer");
  } else if (action === "save") {
    if (amt > acct.balance) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    addTxn(acct, "savings", -amt, "Savings pocket");
  } else if (action === "send") {
    if (amt > acct.balance) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    const recipient = recipientId ? db.providerAccounts[recipientId] : undefined;
    if (!recipient) return NextResponse.json({ error: "Choose who to send to" }, { status: 400 });
    addTxn(acct, "p2p_out", -amt, `${recipient.name} (${recipient.provider})`);
    // The money actually lands in the recipient wallet.
    addTxn(recipient, "p2p_in", amt, `${acct.name} (${mask(acct.phone)})`);
    save();
    audit({ system: acct.provider, actor: acct.name, action: `sent ₦${amt.toLocaleString()} to ${recipient.name}`, subject: acct.id });
    audit({ system: recipient.provider, actor: recipient.name, action: `received ₦${amt.toLocaleString()} from ${acct.name}`, subject: recipient.id });
  } else if (action === "bill") {
    if (amt > acct.balance) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    const b = BILLERS.find((x) => x.id === biller);
    if (!b) return NextResponse.json({ error: "Pick a biller" }, { status: 400 });
    addTxn(acct, CATEGORY_CHANNEL[b.category], -amt, b.name);
    audit({ system: acct.provider, actor: acct.name, action: `paid ${b.name} ₦${amt.toLocaleString()}`, subject: acct.id });
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  save();

  // Fraud alert if this transaction pushed the account into a high-risk state.
  const risk = analyzeRisk(acct.txns);
  const highFlag = risk.flags.find((f) => f.level === "high");
  const alert = highFlag ? { level: "high", text: highFlag.text } : null;

  return NextResponse.json({ ok: true, account: publicAccount(acct), alert });
}
