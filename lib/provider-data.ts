// Generates a realistic transaction history for a mobile-money account, keyed to
// the account holder's earner profile. Runs inside the *provider* system — this
// is the data that actually lives at OPay/Moniepoint/PalmPay and that Reputify later
// pulls with the user's consent. Deterministic per seed so it's reproducible.
import type { EarnerProfile, ProviderTxn } from "./models";

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

interface Spec {
  baseIncome: number;
  incomeChannel: string;
  jitter: number;
  billsShare: number;
  savingsShare: number;
  txPerMonth: number;
}
const SPECS: Record<EarnerProfile, Spec> = {
  trader: { baseIncome: 420000, incomeChannel: "merchant_sale", jitter: 0.15, billsShare: 0.42, savingsShare: 0.18, txPerMonth: 46 },
  salaried: { baseIncome: 190000, incomeChannel: "salary", jitter: 0.12, billsShare: 0.5, savingsShare: 0.1, txPerMonth: 24 },
  gig: { baseIncome: 110000, incomeChannel: "p2p_in", jitter: 0.5, billsShare: 0.66, savingsShare: 0.03, txPerMonth: 30 },
  farmer: { baseIncome: 140000, incomeChannel: "merchant_sale", jitter: 0.8, billsShare: 0.55, savingsShare: 0.06, txPerMonth: 18 },
};

export const PROFILE_LABELS: Record<EarnerProfile, string> = {
  trader: "Market trader — steady daily sales",
  salaried: "Salaried employee — monthly pay",
  gig: "Gig / informal worker — irregular income",
  farmer: "Farmer — seasonal, lumpy income",
};

const OUT = ["bill", "airtime", "p2p_out", "withdrawal"];
const CPS = ["MTN VTU", "Ikeja Electric", "GOtv", "Shoprite", "+2348•••2210", "+2347•••7788", "DStv", "Fuel Stn"];
const money = (v: number) => Math.round(v / 50) * 50;

export function generateHistory(profile: EarnerProfile, seed: string, months = 6, injectLoop = false): { txns: ProviderTxn[]; balance: number } {
  const spec = SPECS[profile];
  const rnd = mulberry32(seedFrom(seed));
  const txns: ProviderTxn[] = [];
  let balance = money(spec.baseIncome * 0.3);
  const now = Date.now();
  const day = 86400000;
  const loopMembers = ["+2348•••4471", "+2348•••9920", "+2348•••1183"];
  let n = 0;
  const push = (tsAbs: number, channel: string, amount: number, cp: string) => {
    balance = Math.max(200, balance + amount);
    txns.push({ id: `t${(n++).toString(36)}${Math.floor(rnd() * 1e5).toString(36)}`, ts: new Date(tsAbs).toISOString(), channel, amount: Math.round(amount), counterparty: cp, balanceAfter: Math.round(balance) });
  };

  for (let m = months - 1; m >= 0; m--) {
    const start = now - m * 30 * day;
    const income = money(spec.baseIncome * (1 + (rnd() - 0.5) * 2 * spec.jitter));
    if (spec.incomeChannel === "merchant_sale") {
      const c = 16 + Math.floor(rnd() * 10);
      for (let i = 0; i < c; i++) push(start + rnd() * 28 * day, "merchant_sale", money((income / c) * (0.5 + rnd())), "POS terminal");
    } else {
      push(start + (2 + rnd() * 4) * day, spec.incomeChannel, income, spec.incomeChannel === "salary" ? "ACME Ltd Payroll" : "Family (diaspora)");
    }
    if (profile === "salaried" && rnd() < 0.5) push(start + (10 + rnd() * 10) * day, "remittance", money(45000 * (0.7 + rnd() * 0.6)), "Western Union");

    if (injectLoop && m < 5) {
      const amt = money(75000 * (0.98 + rnd() * 0.04));
      push(start + 6 * day, "p2p_in", amt, loopMembers[0]);
      push(start + 7 * day, "p2p_out", -amt, loopMembers[1]);
      push(start + 9 * day, "p2p_in", amt, loopMembers[2]);
    }

    const outBudget = income * spec.billsShare;
    const nOut = Math.max(4, Math.floor(spec.txPerMonth * 0.5));
    for (let i = 0; i < nOut; i++) push(start + rnd() * 29 * day, OUT[Math.floor(rnd() * OUT.length)], -money((outBudget / nOut) * (0.4 + rnd() * 1.4)), CPS[Math.floor(rnd() * CPS.length)]);
    if (rnd() < 0.8) push(start + (20 + rnd() * 8) * day, "savings", -money(income * spec.savingsShare * (0.5 + rnd())), "Savings pocket");
  }

  txns.sort((a, b) => a.ts.localeCompare(b.ts));
  return { txns, balance };
}
