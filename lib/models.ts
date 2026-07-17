// Account & system models for the multi-system prototype:
//   - Reputify users (credit identity holders)
//   - Mobile-money provider accounts (OPay / Moniepoint / PalmPay)
//   - Bank staff users
// Each "system" keeps its own accounts; Reputify links to the others via consented
// access tokens (the "tunnels").

export type ProviderId = "opay" | "moniepoint" | "palmpay";
export const PROVIDERS: { id: ProviderId; name: string; color: string }[] = [
  { id: "opay", name: "OPay", color: "#1a936f" },
  { id: "moniepoint", name: "Moniepoint", color: "#0357ee" },
  { id: "palmpay", name: "PalmPay", color: "#6c2bd9" },
];

export type EarnerProfile = "trader" | "salaried" | "gig" | "farmer";

/** On-chain identity material held for a user (prototype custody).
 *  Hedera-native: an Ed25519 keypair; the DID is derived from the public key. */
export interface Wallet {
  privateKey: string; // Ed25519 raw hex — in production this lives in the user's own wallet, never here
  publicKey: string; // Ed25519 raw hex
  keyType: "Ed25519";
  did: string; // did:hedera:<network>:<publicKey>
}

export interface KycCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface KycRecord {
  status: "none" | "pending" | "verified" | "rejected";
  fullName?: string;
  nationalId?: string; // NIN/BVN (synthetic)
  dob?: string;
  nullifier?: string; // HMAC — anti-Sybil, one person one identity
  level?: "basic" | "full";
  verifiedAt?: string;
  attestationCommitment?: string; // = the Verifiable Credential hash
  anchorTxid?: string;
  checks?: KycCheck[];
  reasons?: string[];
}

export interface LinkedProvider {
  provider: ProviderId;
  providerAccountId: string;
  accessToken: string;
  handle: string; // masked phone
  linkedAt: string;
}

export interface RemiUser {
  id: string;
  phone: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  wallet: Wallet;
  didAnchorTxid?: string;
  kyc: KycRecord;
  linked: LinkedProvider[];
  passportId?: string;
}

export interface ProviderTxn {
  id: string;
  ts: string;
  channel: string;
  amount: number; // + inflow / - outflow
  counterparty: string;
  balanceAfter: number;
}

export interface ProviderAccount {
  id: string;
  provider: ProviderId;
  phone: string;
  name: string;
  passwordHash: string;
  salt: string;
  profile: EarnerProfile;
  createdAt: string;
  balance: number;
  txns: ProviderTxn[];
  // consent grants issued to external apps (Reputify) to read this account
  grants: { token: string; audience: string; issuedAt: string; scope: string[] }[];
}

export interface BankUser {
  id: string;
  bankName: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface Session {
  token: string;
  subjectId: string;
  kind: "remi" | "provider" | "bank";
  expiresAt: number;
}

export interface LoanDecision {
  consentId: string;
  passportId: string;
  bankId: string;
  decision: "approved" | "declined";
  amount: number; // approved loan amount (0 if declined)
  decidedAt: string;
}
