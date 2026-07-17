// Persistent JSON-file store. Survives restarts so accounts, wallets and
// on-chain anchors created in one session are still there in the next.
// Production swaps this for Postgres + object storage (the encrypted vault).
import fs from "node:fs";
import path from "node:path";
import type { BankUser, LoanDecision, ProviderAccount, RemiUser, Session } from "./models";
import type { Anchor, ConsentReceipt, CreditPassport } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export interface AuditEntry {
  at: string;
  system: "remi" | "opay" | "moniepoint" | "palmpay" | "bank" | "ledger";
  actor: string;
  action: string;
  subject?: string;
  anchorTxid?: string;
}

interface Schema {
  users: Record<string, RemiUser>;
  providerAccounts: Record<string, ProviderAccount>;
  bankUsers: Record<string, BankUser>;
  sessions: Record<string, Session>;
  passports: Record<string, CreditPassport>;
  consents: Record<string, ConsentReceipt>;
  anchors: Record<string, Anchor>; // by txid
  anchorsBySubject: Record<string, string[]>; // subjectId -> txids
  nullifiers: string[]; // used anti-Sybil nullifiers
  decisions: Record<string, LoanDecision>; // by consentId
  audit: AuditEntry[];
}

function empty(): Schema {
  return {
    users: {}, providerAccounts: {}, bankUsers: {}, sessions: {},
    passports: {}, consents: {}, anchors: {}, anchorsBySubject: {},
    nullifiers: [], decisions: {}, audit: [],
  };
}

const g = globalThis as unknown as { __remidb?: Schema };

function load(): Schema {
  if (g.__remidb) return g.__remidb;
  try {
    if (fs.existsSync(DB_FILE)) {
      g.__remidb = { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
    } else {
      g.__remidb = empty();
    }
  } catch {
    g.__remidb = empty();
  }
  return g.__remidb!;
}

export const db = load();

let saveTimer: NodeJS.Timeout | null = null;
export function save() {
  if (saveTimer) return; // debounce bursts of writes
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
      console.error("db save failed", e);
    }
  }, 50);
}

export function audit(entry: Omit<AuditEntry, "at">) {
  const e = { at: new Date().toISOString(), ...entry };
  db.audit.unshift(e);
  if (db.audit.length > 500) db.audit.pop();
  save();
  return e;
}

export function recordAnchor(a: Anchor) {
  db.anchors[a.txid] = a;
  (db.anchorsBySubject[a.subjectId] ??= []).unshift(a.txid);
  save();
}

export function anchorsForSubject(subjectId: string): Anchor[] {
  return (db.anchorsBySubject[subjectId] ?? []).map((t) => db.anchors[t]).filter(Boolean);
}

export function latestAnchor(subjectId: string): Anchor | undefined {
  const list = db.anchorsBySubject[subjectId];
  return list && list.length ? db.anchors[list[0]] : undefined;
}
