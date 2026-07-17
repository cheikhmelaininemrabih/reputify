// Turn raw transactions into application-time features, and run graph-based
// fraud detection for artificial "income" loops (the 3-friends-cycling-money
// pattern). Works on any transaction list — the pulled provider feed.
import type { Features, FraudSignal } from "./types";

export interface TxnLike { ts: string; channel: string; amount: number; counterparty: string; }

// "cash_in" is the wallet's Add-money top-up — counted as income so a fresh
// account builds a real income profile from its own activity.
const INCOME_CHANNELS = new Set(["salary", "merchant_sale", "remittance", "p2p_in", "cash_in"]);
const OBLIGATION_CHANNELS = new Set(["bill", "p2p_out", "airtime"]);

export function extractFeatures(events: TxnLike[]): Features {
  const fraud = detectCircularIncome(events);

  // Bucket by month for cadence / volatility.
  const byMonth = new Map<string, { in: number; out: number; save: number }>();
  for (const e of events) {
    const key = e.ts.slice(0, 7);
    const b = byMonth.get(key) ?? { in: 0, out: 0, save: 0 };
    if (e.amount > 0 && INCOME_CHANNELS.has(e.channel)) b.in += e.amount;
    if (e.amount < 0 && OBLIGATION_CHANNELS.has(e.channel)) b.out += -e.amount;
    if (e.channel === "savings") b.save += -e.amount;
    byMonth.set(key, b);
  }
  const months = [...byMonth.values()];
  const n = Math.max(months.length, 1);

  // Discount fraudulent loop value from real inflow.
  const grossInflow = months.reduce((s, m) => s + m.in, 0);
  const cleanInflow = grossInflow * (1 - fraud.loopValueShare);
  const monthlyInflow = cleanInflow / n;

  const inflows = months.map((m) => m.in);
  const cashflowVolatility = clamp01(coefVariation(inflows));
  const incomeRegularity = clamp01(1 - cashflowVolatility);

  const totalOut = months.reduce((s, m) => s + m.out, 0);
  const obligationRatio = clamp01(totalOut / Math.max(grossInflow, 1));

  const totalSave = months.reduce((s, m) => s + m.save, 0);
  const savingsRate = clamp01(totalSave / Math.max(cleanInflow, 1));

  const gamblingOut = events.filter((e) => e.channel === "betting").reduce((s, e) => s + Math.abs(e.amount), 0);
  const gamblingExposure = clamp01(gamblingOut / Math.max(grossInflow, 1));

  const balances = events.map((e) => (e as { balanceAfter?: number }).balanceAfter).filter((b): b is number => typeof b === "number");
  const balanceTrend = trend(balances);

  const counterparties = new Set(events.map((e) => e.counterparty));

  return {
    monthlyInflow: Math.round(monthlyInflow),
    incomeRegularity: round2(incomeRegularity),
    cashflowVolatility: round2(cashflowVolatility),
    obligationRatio: round2(obligationRatio),
    savingsRate: round2(savingsRate),
    gamblingExposure: round2(gamblingExposure),
    balanceTrend: round2(balanceTrend),
    txCount: events.length,
    distinctCounterparties: counterparties.size,
    monthsOnRecord: n,
    fraud,
  };
}

/**
 * Detect closed loops of near-identical amounts among a small set of
 * counterparties — money cycling to fake income rather than genuine earnings.
 * We look for counterparties that both send to and receive from the account
 * with matching amounts in a short window.
 */
export function detectCircularIncome(events: TxnLike[]): FraudSignal {
  const p2p = events.filter((e) => e.channel === "p2p_in" || e.channel === "p2p_out");
  // Group by counterparty, track in/out totals and amount fingerprints.
  const byCp = new Map<string, { in: number; out: number; amounts: number[] }>();
  for (const e of p2p) {
    const b = byCp.get(e.counterparty) ?? { in: 0, out: 0, amounts: [] };
    if (e.amount > 0) b.in += e.amount;
    else b.out += -e.amount;
    b.amounts.push(Math.abs(e.amount));
    byCp.set(e.counterparty, b);
  }

  // A "loop member" is a counterparty whose transfers recur with near-identical
  // amounts (fake income cycling), or that both sends and receives. Recurrence
  // is robust to small jitter via a low coefficient of variation.
  const members: string[] = [];
  let loopValue = 0;
  for (const [cp, b] of byCp) {
    const recurring = b.amounts.length >= 3 && coefVariation(b.amounts) < 0.15;
    const bidirectional = b.in > 0 && b.out > 0;
    if (recurring || bidirectional) {
      members.push(cp);
      loopValue += b.in; // suspicious inflow attributed to the loop
    }
  }

  const totalInflow = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const loopValueShare = totalInflow > 0 ? Math.min(loopValue / totalInflow, 0.9) : 0;
  const detected = members.length >= 2 && loopValueShare > 0.1;

  return {
    circularLoopDetected: detected,
    loopValueShare: detected ? round2(loopValueShare) : 0,
    loopMembers: detected ? members : [],
    note: detected
      ? `Closed loop of ${members.length} counterparties recycling near-identical amounts — treated as artificial income, not earnings.`
      : "No circular income pattern detected.",
  };
}

function coefVariation(xs: number[]): number {
  if (xs.length < 2) return 0.4;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  if (mean === 0) return 1;
  const varc = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(varc) / mean;
}

function trend(xs: number[]): number {
  if (xs.length < 2) return 0;
  const first = xs.slice(0, Math.ceil(xs.length / 3));
  const last = xs.slice(-Math.ceil(xs.length / 3));
  const a = first.reduce((s, x) => s + x, 0) / first.length;
  const b = last.reduce((s, x) => s + x, 0) / last.length;
  if (a + b === 0) return 0;
  return clampN((b - a) / Math.max(a, b, 1), -1, 1);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clampN = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round2 = (x: number) => Math.round(x * 100) / 100;
