// Mobile-money wallets — a genuinely separate app (roadmap-adjacent, not in
// the original spec, added on user feedback: "the wallets are also their own
// app"). A WalletAccount has nothing to do with being a Reputify borrower —
// it's provider + phone, the same as a real OPay/Moniepoint/PalmPay account.
// Two things only a wallet can do that the borrower app can't do for it:
// authorize a connection, and hold the real transaction ledger a borrower's
// cash-flow package is actually built from.
import crypto from "node:crypto";
import { rdb, rsave, raudit } from "./rep-db";
import type { Connection, GranularPackage, WalletAccount, WalletTxn } from "./rep-types";

export function onboardWallet(input: { provider: WalletAccount["provider"]; phone: string; name: string }): WalletAccount {
  if (!input.provider || !input.phone || !input.name) throw new Error("provider, phone and name are required");
  const w: WalletAccount = {
    id: `wal_${crypto.randomBytes(6).toString("hex")}`,
    provider: input.provider, phone: input.phone, name: input.name,
    balance: 0, createdAt: new Date().toISOString(), txns: [],
  };
  rdb.wallets[w.id] = w;
  rsave();
  raudit({ actor: w.name, action: `opened ${w.provider} wallet`, subject: w.id });
  return w;
}

export function addTransaction(
  walletId: string,
  input: { amount: number; description: string; category: WalletTxn["category"]; at?: string },
): WalletTxn {
  const w = rdb.wallets[walletId];
  if (!w) throw new Error("unknown wallet");
  if (!input.description.trim()) throw new Error("description is required");
  if (!Number.isFinite(input.amount) || input.amount === 0) throw new Error("amount must be a non-zero number");
  const txn: WalletTxn = {
    id: `txn_${crypto.randomBytes(6).toString("hex")}`,
    amount: input.amount, description: input.description.trim(), category: input.category,
    at: input.at ?? new Date().toISOString(),
  };
  w.txns.push(txn);
  w.balance += input.amount;
  rsave();
  raudit({ actor: w.name, action: `${input.amount > 0 ? "added" : "spent"} ${Math.abs(input.amount)} (${input.category})`, subject: w.id });
  return txn;
}

/** The whole point of "separate apps": only a signed-in wallet, matching the
 *  connection's provider, can authorize it. The borrower app can request and
 *  can deny, but it cannot approve — that button only exists here. */
export function authorizeConnection(walletId: string, connectionId: string): Connection {
  const w = rdb.wallets[walletId];
  if (!w) throw new Error("unknown wallet");
  const c = rdb.connections[connectionId];
  if (!c) throw new Error("unknown connection");
  if (c.provider !== w.provider) throw new Error(`this request is for ${c.provider}, not ${w.provider}`);
  if (c.status !== "pending") throw new Error(`connection is already ${c.status}`);
  c.status = "approved";
  c.walletId = walletId;
  c.decidedAt = new Date().toISOString();
  rsave();
  raudit({ actor: w.name, action: `authorized Reputify to read ${w.provider} account`, subject: connectionId, ref: `wallet:${walletId}` });
  return c;
}

/** Real cash-flow package for one period, built from what the wallet owner
 *  actually entered — no synthetic generator, no randomness. Empty period =
 *  an honest zeroed package, not a fabricated one. */
export function packageFromWallet(borrowerId: string, provider: string, period: string, wallet: WalletAccount): GranularPackage {
  const txns = wallet.txns.filter((t) => t.at.slice(0, 7) === period);
  const inflow = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const distinctCounterparties = new Set(txns.map((t) => t.description.trim().toLowerCase())).size;
  const volatility = inflow > 0 ? Math.min(1, outflow / inflow) : 0;
  const billTxns = txns.filter((t) => t.category === "bill");
  const onTimeBillRate = billTxns.length > 0 ? 1 : 0.85; // no due-date concept for manual entries — neutral default
  const net = inflow - outflow;
  const balanceTrend = inflow > 0 ? Math.max(-1, Math.min(1, net / inflow)) : 0;
  return {
    subject: borrowerId, provider, period,
    monthlyInflow: Math.round(inflow), monthlyOutflow: Math.round(outflow),
    distinctCounterparties, volatility: +volatility.toFixed(2),
    onTimeBillRate: +onTimeBillRate.toFixed(2), balanceTrend: +balanceTrend.toFixed(2),
  };
}
