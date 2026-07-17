// AI risk & fraud engine that runs inside the wallet on every transaction.
// Surfaces the same signals Reputify's credit model cares about — gambling
// exposure, circular income loops, spending velocity — so the account holder
// (and the provider) see risk build up in real time.
import { detectCircularIncome, type TxnLike } from "./features";
import type { FraudSignal } from "./types";

export interface RiskFlag {
  level: "info" | "warn" | "high";
  code: string;
  text: string;
}

export interface RiskAnalysis {
  riskScore: number; // 0..100, higher = riskier
  riskLevel: "healthy" | "elevated" | "high";
  gamblingExposure: number; // 0..1 of inflow
  gamblingTotal: number;
  velocitySpike: boolean;
  loop: FraudSignal;
  flags: RiskFlag[];
}

const WINDOW_MS = 60 * 60 * 1000; // 1h burst window

export function analyzeRisk(txns: TxnLike[] & { amount: number; ts: string; channel: string }[]): RiskAnalysis {
  const inflow = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0) || 1;
  const gamblingTotal = txns.filter((t) => t.channel === "betting").reduce((s, t) => s + Math.abs(t.amount), 0);
  const gamblingExposure = Math.min(gamblingTotal / inflow, 1);
  const loop = detectCircularIncome(txns);

  // Velocity: 4+ transactions inside any 1-hour window.
  const times = txns.map((t) => new Date(t.ts).getTime()).sort((a, b) => a - b);
  let velocitySpike = false;
  for (let i = 0; i + 3 < times.length; i++) if (times[i + 3] - times[i] <= WINDOW_MS) { velocitySpike = true; break; }

  const flags: RiskFlag[] = [];
  if (gamblingExposure >= 0.3) flags.push({ level: "high", code: "GAMBLING_HIGH", text: `Heavy betting activity — ${Math.round(gamblingExposure * 100)}% of income spent on gambling.` });
  else if (gamblingExposure >= 0.12) flags.push({ level: "warn", code: "GAMBLING", text: `Elevated gambling spend (${Math.round(gamblingExposure * 100)}% of income).` });
  if (loop.circularLoopDetected) flags.push({ level: "high", code: "LOOP", text: loop.note });
  if (velocitySpike) flags.push({ level: "warn", code: "VELOCITY", text: "Rapid burst of transactions detected — unusual spending velocity." });
  if (flags.length === 0) flags.push({ level: "info", code: "OK", text: "No fraud or risk patterns detected. Healthy account behaviour." });

  const riskScore = Math.min(100, Math.round(gamblingExposure * 55 + (loop.circularLoopDetected ? loop.loopValueShare * 45 : 0) + (velocitySpike ? 15 : 0)));
  const riskLevel = riskScore >= 55 ? "high" : riskScore >= 25 ? "elevated" : "healthy";

  return { riskScore, riskLevel, gamblingExposure: round2(gamblingExposure), gamblingTotal, velocitySpike, loop, flags };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
