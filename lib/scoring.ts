// Scoring engine. A transparent logistic model over application-time features
// produces a probability of default (PD); the PD maps to a 300–850 score via a
// fixed points-to-double-odds calibration (batch-independent). Reason codes are
// the top signed contributions — regulator-style adverse-action reasons.
//
// This is the prototype stand-in for the trained classifier described in the
// architecture report: same shape (features → PD → score), swappable for a
// GBM/logistic model trained on real outcomes without touching callers.
import type { Features, ReasonCode, Score } from "./types";

interface Term {
  code: string;
  label: string;
  weight: number;
  value: (f: Features) => number; // standardized-ish contribution input, ~[-1,1]
}

// Positive weight => raises default odds. Signs chosen for causal plausibility.
const INTERCEPT = -1.75;
const TERMS: Term[] = [
  {
    code: "INCOME_LEVEL",
    label: "Monthly income level",
    weight: -1.3,
    value: (f) => clampN(f.monthlyInflow / 300000, 0, 1.5) - 0.5,
  },
  {
    code: "INCOME_STABILITY",
    label: "Income regularity",
    weight: -1.2,
    value: (f) => f.incomeRegularity - 0.5,
  },
  {
    code: "CASHFLOW_VOL",
    label: "Cash-flow volatility",
    weight: 1.4,
    value: (f) => f.cashflowVolatility - 0.4,
  },
  {
    code: "OBLIGATIONS",
    label: "Obligations vs income",
    weight: 1.5,
    value: (f) => f.obligationRatio - 0.5,
  },
  {
    code: "SAVINGS",
    label: "Savings behaviour",
    weight: -1.0,
    value: (f) => clampN(f.savingsRate / 0.2, 0, 1) - 0.4,
  },
  {
    code: "BALANCE_TREND",
    label: "Balance trend",
    weight: -0.7,
    value: (f) => f.balanceTrend,
  },
  {
    code: "THIN_FILE",
    label: "Depth of record",
    weight: 0.6,
    value: (f) => 0.5 - clampN(f.monthsOnRecord / 6, 0, 1),
  },
  {
    code: "GAMBLING",
    label: "Gambling exposure",
    weight: 1.8,
    value: (f) => f.gamblingExposure,
  },
  {
    code: "FRAUD_LOOP",
    label: "Artificial-income loop",
    weight: 2.6,
    value: (f) => (f.fraud.circularLoopDetected ? f.fraud.loopValueShare : 0),
  },
];

// Points-to-double-odds calibration (batch-independent).
const PDO = 40;
const FACTOR = PDO / Math.log(2);
const BASE_SCORE = 600;
const BASE_GOOD_ODDS = 12; // (1-pd)/pd at 600 (~7.7% PD anchors the middle of the range)

export function scoreFeatures(f: Features): Score {
  let logOdds = INTERCEPT;
  const contribs: { term: Term; contribution: number }[] = [];
  for (const t of TERMS) {
    const c = t.weight * t.value(f);
    logOdds += c;
    contribs.push({ term: t, contribution: c });
  }

  const pd = sigmoid(logOdds);
  const score = pdToScore(pd);
  const band: Score["band"] = score >= 680 ? "Low risk" : score >= 560 ? "Medium risk" : "High risk";

  // Reason codes: largest-magnitude contributions. Positive contribution to
  // log-odds pushes toward default => shown as a negative factor for the score.
  const reasons: ReasonCode[] = contribs
    .filter((c) => Math.abs(c.contribution) > 0.05)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 5)
    .map((c) => ({
      code: c.term.code,
      label: c.term.label,
      direction: c.contribution > 0 ? "negative" : "positive",
      weight: round2(Math.abs(c.contribution)),
    }));

  return { pd: round4(pd), score, band, reasons };
}

function pdToScore(pd: number): number {
  const p = clampN(pd, 1e-4, 1 - 1e-4);
  const goodOdds = (1 - p) / p;
  const s = BASE_SCORE + FACTOR * (Math.log(goodOdds) - Math.log(BASE_GOOD_ODDS));
  return Math.round(clampN(s, 300, 850));
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clampN = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10000) / 10000;
