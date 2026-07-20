// Core domain types for Reputify — a portable credit identity anchored on Hedera.

export type Channel =
  | "salary"
  | "merchant_sale"
  | "remittance"
  | "p2p_in"
  | "p2p_out"
  | "bill"
  | "airtime"
  | "savings"
  | "withdrawal";

/** One normalized mobile-money event. This is the raw off-chain signal. */
export interface MoneyEvent {
  id: string;
  ts: string; // ISO
  channel: Channel;
  amount: number; // NGN, positive = inflow, negative = outflow
  counterparty: string; // masked handle
  balanceAfter: number;
}

export type PersonaId = "amara" | "ngozi" | "tunde";

export interface Feed {
  borrowerRef: string; // opaque per-borrower id
  persona: PersonaId;
  displayName: string;
  provider: "OPay" | "Moniepoint" | "PalmPay";
  months: number;
  events: MoneyEvent[];
}

/** Features derived at "application time" — the inputs to scoring. */
export interface Features {
  monthlyInflow: number;
  incomeRegularity: number; // 0..1  (how steady the income cadence is)
  cashflowVolatility: number; // 0..1  (higher = riskier)
  obligationRatio: number; // 0..1  (bills+p2p_out / inflow)
  savingsRate: number; // 0..1
  gamblingExposure: number; // 0..1  (betting outflow / inflow)
  balanceTrend: number; // -1..1 (declining..growing)
  txCount: number;
  distinctCounterparties: number;
  monthsOnRecord: number;
  fraud: FraudSignal;
}

export interface FraudSignal {
  circularLoopDetected: boolean;
  loopValueShare: number; // 0..1 share of inflow that is suspicious
  loopMembers: string[];
  note: string;
}

export interface AiRiskFlag {
  severity: "info" | "warn" | "high";
  text: string;
}

/** The fraud/risk verdict that drives a Passport. Produced by the OpenAI analyst
 *  at build time; falls back to the deterministic heuristic if OpenAI is unavailable. */
export interface AiRiskVerdict {
  source: "openai" | "heuristic";
  model?: string;
  riskLevel: "low" | "medium" | "high";
  circularLoopDetected: boolean;
  loopValueShare: number; // 0..1 share of inflow judged artificial
  gamblingConcern: boolean;
  flags: AiRiskFlag[];
  narrative: string;
}

export interface ReasonCode {
  code: string;
  label: string;
  direction: "positive" | "negative";
  weight: number; // relative contribution
}

export interface Score {
  pd: number; // probability of default 0..1
  score: number; // 300..850
  band: "Low risk" | "Medium risk" | "High risk";
  reasons: ReasonCode[];
}

/** The shareable credit object. Raw data never leaves the vault — this does. */
export interface CreditPassport {
  version: 1;
  passportId: string;
  did: string; // borrower decentralized identifier
  issuedAt: string;
  score: Score;
  features: Features; // held off-chain; only the commitment is anchored
  commitment: string; // sha256 over the canonical passport body — anchored on Hedera
  sybilNullifier: string; // HMAC(id) — one-person-one-passport, not reversible
  aiRisk?: AiRiskVerdict; // the fraud/risk verdict that drove this passport
}

export type AnchorKind = "did" | "kyc" | "passport" | "consent" | "audit";

export interface Anchor {
  kind: AnchorKind;
  commitment: string; // the 32-byte hash committed
  txid: string;
  network: "test" | "main";
  broadcast: boolean; // true = live on-chain; false = signed but simulated
  rawTxSize: number;
  explorerUrl: string;
  createdAt: string;
  subjectId: string; // passportId / consentId
}

export interface ConsentReceipt {
  version: 1;
  consentId: string;
  passportId: string;
  did: string;
  audience: string; // bank id the grant is for
  scope: string[]; // e.g. ["score","band","reasons"]
  purpose: string;
  issuedAt: string;
  expiresAt: string;
  signature: string; // borrower key signature over the receipt
  commitment: string; // sha256 of the receipt — anchored on Hedera
  revoked?: boolean;
  revokedAt?: string;
  revocationCommitment?: string; // sha256 of the revocation event — anchored on Hedera
}

/** What a bank actually receives — attestations, never the raw feed. */
export interface Attestation {
  passportId: string;
  did: string;
  score: number;
  band: string;
  reasons: ReasonCode[];
  fraudChecked: boolean;
  issuedAt: string;
  commitment: string; // the passport commitment the bank can verify on-chain
  passportAnchor?: Anchor;
  consentId: string;
  consentValidUntil: string;
}
