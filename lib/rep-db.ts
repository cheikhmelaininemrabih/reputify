// Isolated JSON store for the attestation-and-lending system. Kept separate from
// the existing lib/db.ts so the roadmap system never interferes with the credit-
// passport app. Same singleton + debounced-save pattern. Production → Postgres
// (contracts+records) + object storage (encrypted blobs).
import fs from "node:fs";
import path from "node:path";
import type {
  AssetDocument, Attester, AttestationMsg, Borrower, Challenge, Connection,
  Disclosure, EncryptedFile, EncryptedPackage, Lender, LenderSub, Loan, WalletAccount,
} from "./rep-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "rep-db.json");

export interface RepAudit {
  at: string;
  actor: string;
  action: string;
  subject?: string;
  ref?: string; // attestation seq / loanId / txid
}

interface RepSchema {
  borrowers: Record<string, Borrower>;
  connections: Record<string, Connection>;
  attesters: Record<string, Attester>;      // by address
  attestations: Record<number, AttestationMsg>; // by seq
  packages: Record<string, EncryptedPackage>;   // by uri
  loans: Record<number, Loan>;
  challenges: Record<number, Challenge>;
  disclosures: Record<string, Disclosure>;
  personhoods: Record<string, string>;       // personhoodId -> borrowerId (anti-Sybil)
  documents: Record<string, AssetDocument>;
  files: Record<string, EncryptedFile>;      // by uri — KYC photos + uploaded documents
  lenders: Record<string, Lender>;
  lenderSubs: Record<string, LenderSub>;     // by lenderId
  wallets: Record<string, WalletAccount>;
  seq: { attestation: number; loan: number; challenge: number };
  audit: RepAudit[];
}

function empty(): RepSchema {
  return {
    borrowers: {}, connections: {}, attesters: {}, attestations: {},
    packages: {}, loans: {}, challenges: {}, disclosures: {}, personhoods: {},
    documents: {}, files: {}, lenders: {}, lenderSubs: {}, wallets: {},
    seq: { attestation: 0, loan: 0, challenge: 0 },
    audit: [],
  };
}

const g = globalThis as unknown as { __repdb?: RepSchema };

function load(): RepSchema {
  if (g.__repdb) return g.__repdb;
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      g.__repdb = { ...empty(), ...parsed, seq: { ...empty().seq, ...(parsed.seq ?? {}) } };
    } else {
      g.__repdb = empty();
    }
  } catch {
    g.__repdb = empty();
  }
  return g.__repdb!;
}

export const rdb = load();

let saveTimer: NodeJS.Timeout | null = null;
export function rsave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(rdb, null, 2));
    } catch (e) {
      console.error("rep-db save failed", e);
    }
  }, 50);
}

export function raudit(entry: Omit<RepAudit, "at">) {
  const e = { at: new Date().toISOString(), ...entry };
  rdb.audit.unshift(e);
  if (rdb.audit.length > 1000) rdb.audit.pop();
  rsave();
  return e;
}

/** Monotonic sequence counters (HCS gives real seq numbers; here we mint them). */
export function nextSeq(kind: keyof RepSchema["seq"]): number {
  rdb.seq[kind] += 1;
  rsave();
  return rdb.seq[kind];
}

/** Test helper: wipe everything (used by the acceptance-scenario harness). */
export function _resetRepDb() {
  const e = empty();
  (Object.keys(e) as (keyof RepSchema)[]).forEach((k) => {
    (rdb as any)[k] = (e as any)[k];
  });
  rsave();
}
