// Mock PSP (roadmap §6/§13) — a stub so the whole system runs without a live
// OPay/Moniepoint agreement. Exposes a fake OAuth "connect" and a /summary that
// returns generated cash-flow data. Production = OAuth authorization-code flow
// returning a scoped, revocable, long-lived standing-consent token.
import crypto from "node:crypto";
import type { GranularPackage } from "./rep-types";

/** Deterministic PRNG seeded from a string, so a borrower's data is stable across
 *  runs (a real PSP would return real history). */
function seeded(seedStr: string): () => number {
  let h = parseInt(crypto.createHash("sha256").update(seedStr).digest("hex").slice(0, 13), 16);
  return () => {
    h = (h * 1103515245 + 12345) % 2147483648;
    return h / 2147483648;
  };
}

/** Fake OAuth: user "authenticates" on the PSP and grants standing consent. */
export function mockOAuthConnect(provider: string): { token: string; scope: string[] } {
  return {
    token: `psp_${provider.toLowerCase()}_${crypto.randomBytes(12).toString("hex")}`,
    scope: ["cashflow.read", "standing"],
  };
}

interface SummaryOpts {
  /** Fabricate an inflated, too-good-to-be-true summary — models a lying attester. */
  fabricate?: boolean;
}

/** The PSP /summary endpoint: monthly cash-flow figures for one connected account. */
export function fetchSummary(
  borrowerId: string, provider: string, period: string, opts: SummaryOpts = {},
): GranularPackage {
  const rnd = seeded(`${borrowerId}|${provider}|${period}`);
  const baseInflow = 180_000 + Math.floor(rnd() * 420_000); // ₦180k–₦600k
  const inflow = opts.fabricate ? baseInflow * (3 + Math.floor(rnd() * 3)) : baseInflow;
  const outflow = Math.floor(inflow * (0.55 + rnd() * 0.25));
  return {
    subject: borrowerId,
    provider,
    period,
    monthlyInflow: inflow,
    monthlyOutflow: outflow,
    distinctCounterparties: 8 + Math.floor(rnd() * 30),
    volatility: opts.fabricate ? 0.08 : +(0.15 + rnd() * 0.4).toFixed(2),
    onTimeBillRate: opts.fabricate ? 1 : +(0.7 + rnd() * 0.3).toFixed(2),
    balanceTrend: opts.fabricate ? 0.9 : +(-0.2 + rnd() * 1.0).toFixed(2),
  };
}

/** Iterate the last N monthly periods ending at `endPeriod` (YYYY-MM). */
export function recentPeriods(endPeriod: string, n: number): string[] {
  const [y, m] = endPeriod.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
