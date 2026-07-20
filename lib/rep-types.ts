// Types for the attestation-and-lending system described in the technical
// roadmap. Two decoupled on-chain worlds plus off-chain money and data:
//   World A — HCS: append-only attestation log (see lib/attestation.ts)
//   World B — "HSCS" contracts, modelled in lib/contracts.ts (AttesterRegistry,
//             LoanRegistry, DisputeResolver). The Solidity production reference
//             lives in /contracts.
// Nothing here is loan *value*; the chain records facts, money moves off-chain.

/** Custodial key material for a borrower or attester. In production the signing
 *  key lives in the user's own wallet (non-custodial / MPC); here it is held
 *  server-side, encrypted-at-rest in a real deployment (KMS/HSM). */
export interface RepWallet {
  // Ed25519 identity/consent key (raw hex) — signs attestations & consent.
  signPublicKey: string;
  signPrivateKey: string;
  // X25519 encryption key (DER base64) — packages are encrypted to this key.
  encPublicKey: string;
  encPrivateKey: string;
  address: string; // "0.0.x"-style shared identity used across both worlds
  did: string;     // did:hedera:<network>:<signPublicKey>
}

export interface Borrower {
  id: string;
  name: string;
  phone: string;
  wallet: RepWallet;
  personhoodId: string; // BVN/NIN stub — one real person, anti-Sybil
  createdAt: string;
  defaulted?: boolean;  // set when a loan of theirs defaults (for the demo)
}

/** A connected mobile-money provider = standing consent (revocable OAuth token). */
export interface Connection {
  id: string;
  borrowerId: string;
  provider: "OPay" | "Moniepoint" | "PalmPay";
  tokenEnc: string;    // PSP OAuth token, encrypted at rest
  scope: string[];
  connectedAt: string;
  revoked?: boolean;
}

/** The granular package the lender underwrites on. Never touches the chain;
 *  only its SHA-256 hash does (as an attestation). */
export interface GranularPackage {
  subject: string;   // borrowerId
  provider: string;
  period: string;    // "2026-01"
  monthlyInflow: number;      // NGN
  monthlyOutflow: number;
  distinctCounterparties: number;
  volatility: number;         // 0..1
  onTimeBillRate: number;     // 0..1
  balanceTrend: number;       // -1..1
}

/** Ciphertext blob in the off-chain store. Host is untrusted → ciphertext only. */
export interface EncryptedPackage {
  uri: string;
  ownerBorrowerId: string;   // encrypted-to
  hash: string;              // SHA-256 of the canonical plaintext (== attestation.hash)
  ephPublicKey: string;      // ephemeral X25519 pub (DER b64)
  iv: string;                // b64
  authTag: string;           // b64
  ciphertext: string;        // b64
  period: string;
  provider: string;
}

/** One HCS attestation message. `seq` is the consensus sequence number that a
 *  LoanRegistry.reliedOn entry points to — the only join between the two worlds. */
export interface AttestationMsg {
  seq: number;
  v: 1;
  subject: string;   // borrowerId
  attester: string;  // attester address (shared identity w/ AttesterRegistry)
  type: "throughput";
  period: string;
  hash: string;      // SHA-256 of the granular package
  sig: string;       // attester Ed25519 signature over the canonical fields
  packageUri: string;
  consensusTimestamp: string;
  broadcast: boolean; // true = real HCS submit; false = simulated
}

export interface Attester {
  address: string;
  name: string;
  signPublicKey: string;  // verify attestation signatures against this
  signPrivateKey: string; // custodial (PoC) — headless attester job signs with this
  accredited: boolean;
  bond: number;          // locked stake (test HBAR units)
  withdrawableAt?: number; // epoch ms after requestWithdraw() cooldown
  createdAt: string;
}

export type LoanState = "Active" | "Repaid" | "Defaulted";

export interface Loan {
  loanId: number;
  lender: string;
  borrower: string;   // borrowerId
  principal: number;  // NGN minor units (data, not transferred)
  issuedAt: string;
  dueAt: string;
  state: LoanState;
  reliedOn: number[]; // HCS attestation sequence numbers the lender trusted
  defaultedAt?: string;
}

export interface Challenge {
  challengeId: number;
  loanId: number;
  attestationSeq: number;
  evidenceURI: string;
  raisedAt: string;
  ruled: boolean;
  upheld?: boolean;
  ruledAt?: string;
  slashed?: number;
}

/** A lender's request to see a borrower's granular packages (selective disclosure). */
export interface Disclosure {
  id: string;
  borrowerId: string;
  lenderId: string;
  state: "pending" | "allowed" | "denied";
  requestedAt: string;
  decidedAt?: string;
  released?: boolean; // PoC: backend released the data key on approval
}

/** On-chain economic parameters (contract config). */
export const PARAMS = {
  minBond: 1000,            // minimum attester stake
  withdrawCooldownMs: 1000 * 60 * 60 * 24 * 3, // 3-day cooldown
  challengeWindowMs: 1000 * 60 * 60 * 24 * 14, // 14-day window after default
};
