// LLM fraud/risk analyst. Runs at Passport-build time: summarizes the pulled
// mobile-money transactions and asks OpenAI for a structured fraud/risk verdict
// (artificial income loops, gambling exposure, structuring/velocity). Falls back
// to the deterministic heuristic engine when OpenAI is unavailable — so the app
// never blocks on the network, and the verdict is reproducible offline.
import { chat, hasOpenAI } from "./openai";
import { analyzeRisk } from "./fraud";
import type { ProviderTxn } from "./models";
import type { AiRiskVerdict } from "./types";

const MODEL = "gpt-4o-mini";
const INCOME = new Set(["salary", "merchant_sale", "remittance", "p2p_in", "cash_in"]);

/** Compact, token-efficient view of a transaction history for the model. */
function summarize(txns: ProviderTxn[]) {
  const byChannel: Record<string, { count: number; total: number }> = {};
  const byCp: Record<string, { in: number; out: number; count: number }> = {};
  const incomeByMonth: Record<string, number> = {};
  let inflow = 0, outflow = 0, betting = 0;
  const times: number[] = [];
  for (const t of txns) {
    const ch = (byChannel[t.channel] ??= { count: 0, total: 0 });
    ch.count++; ch.total += t.amount;
    if (t.amount > 0) inflow += t.amount; else outflow += -t.amount;
    if (t.channel === "betting") betting += Math.abs(t.amount);
    if (t.amount > 0 && INCOME.has(t.channel)) {
      const m = t.ts.slice(0, 7);
      incomeByMonth[m] = (incomeByMonth[m] ?? 0) + t.amount;
    }
    const cp = (byCp[t.counterparty] ??= { in: 0, out: 0, count: 0 });
    cp.count++;
    if (t.amount > 0) cp.in += t.amount; else cp.out += -t.amount;
    times.push(new Date(t.ts).getTime());
  }
  times.sort((a, b) => a - b);
  let maxBurst = 0;
  for (let i = 0; i < times.length; i++) {
    let j = i;
    while (j < times.length && times[j] - times[i] <= 3600000) j++;
    maxBurst = Math.max(maxBurst, j - i);
  }
  const topCounterparties = Object.entries(byCp)
    .map(([name, v]) => ({ name, inflow: Math.round(v.in), outflow: Math.round(v.out), count: v.count, bidirectional: v.in > 0 && v.out > 0 }))
    .sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow))
    .slice(0, 10);
  return {
    currency: "NGN",
    txCount: txns.length,
    totalInflow: Math.round(inflow),
    totalOutflow: Math.round(outflow),
    bettingTotal: Math.round(betting),
    incomeByMonth,
    byChannel: Object.fromEntries(Object.entries(byChannel).map(([k, v]) => [k, { count: v.count, total: Math.round(v.total) }])),
    topCounterparties,
    maxTxnsIn1h: maxBurst,
  };
}

const SYSTEM = `You are a credit-risk and fraud analyst for a mobile-money lender. You receive a JSON
summary of one applicant's mobile-money transaction history (synthetic data). Assess fraud and
repayment risk. Look especially for:
- Artificial income loops: money cycling between a small set of counterparties (bidirectional flows,
  near-identical recurring amounts) to fake income. Estimate the SHARE of total inflow that looks
  artificial as loopValueShare (0..1).
- Gambling exposure: betting spend as a share of income; heavy betting is a repayment risk.
- Structuring / velocity: bursts of many transactions in a short window.
Respond with ONLY a JSON object of exactly this shape:
{
  "riskLevel": "low" | "medium" | "high",
  "circularLoopDetected": boolean,
  "loopValueShare": number,
  "gamblingConcern": boolean,
  "flags": [ { "severity": "info" | "warn" | "high", "text": string } ],
  "narrative": string
}
Give 1-4 concise flags and a 1-2 sentence narrative for the lender. Be fair: a steady earner with low
betting and no loops is low risk. Never invent data that is not in the summary.`;

const clamp01 = (x: any) => Math.max(0, Math.min(1, Number(x) || 0));

function heuristicVerdict(txns: ProviderTxn[]): AiRiskVerdict {
  const h = analyzeRisk(txns);
  return {
    source: "heuristic",
    riskLevel: h.riskLevel === "healthy" ? "low" : h.riskLevel === "elevated" ? "medium" : "high",
    circularLoopDetected: h.loop.circularLoopDetected,
    loopValueShare: clamp01(h.loop.loopValueShare),
    gamblingConcern: h.gamblingExposure >= 0.2,
    flags: h.flags.map((f) => ({ severity: f.level, text: f.text })),
    narrative: h.flags.map((f) => f.text).join(" "),
  };
}

/** Fraud/risk verdict for a Passport. OpenAI when available, heuristic otherwise. */
export async function analyzeFraud(txns: ProviderTxn[]): Promise<AiRiskVerdict> {
  const fallback = heuristicVerdict(txns);
  if (!hasOpenAI() || txns.length === 0) return fallback;
  try {
    const raw = await chat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(summarize(txns)) },
      ],
      { model: MODEL, json: true, temperature: 0.2, maxTokens: 500, timeoutMs: 15000 }
    );
    const p = JSON.parse(raw);
    const riskLevel = ["low", "medium", "high"].includes(p.riskLevel) ? p.riskLevel : fallback.riskLevel;
    const flags = Array.isArray(p.flags)
      ? p.flags
          .filter((f: any) => f && typeof f.text === "string")
          .slice(0, 4)
          .map((f: any) => ({ severity: ["info", "warn", "high"].includes(f.severity) ? f.severity : "warn", text: String(f.text).slice(0, 180) }))
      : [];
    return {
      source: "openai",
      model: MODEL,
      riskLevel,
      circularLoopDetected: !!p.circularLoopDetected,
      loopValueShare: clamp01(p.loopValueShare),
      gamblingConcern: !!p.gamblingConcern,
      flags: flags.length ? flags : fallback.flags,
      narrative: typeof p.narrative === "string" && p.narrative.trim() ? p.narrative.slice(0, 400) : fallback.narrative,
    };
  } catch {
    return fallback;
  }
}
