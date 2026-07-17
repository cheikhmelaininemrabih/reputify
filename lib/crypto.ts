// Hashing / commitment helpers. Uses Node's crypto so commitments are the same
// bytes regardless of the anchoring chain (SHA-256 is chain-agnostic).
import { createHash, createHmac } from "node:crypto";

/** Deterministic JSON: stable key order so a commitment is reproducible. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(v: any): any {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.keys(v)
      .sort()
      .reduce((acc: Record<string, any>, k) => {
        acc[k] = sortDeep(v[k]);
        return acc;
      }, {});
  }
  return v;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Commitment over any object = sha256 of its canonical form. */
export function commit(value: unknown): string {
  return sha256Hex(canonical(value));
}

/**
 * Anti-Sybil nullifier. HMAC of the low-entropy identifier under a server-held
 * key. Publishing this (not the raw ID hash) means an attacker cannot confirm
 * whether a given national ID is enrolled by brute force, and destroying the
 * key makes it permanently unlinkable (crypto-shredding).
 */
export function sybilNullifier(nationalId: string, secret: string): string {
  return createHmac("sha256", secret).update(`reputify:sybil:${nationalId}`).digest("hex");
}

export function shortHash(hex: string, n = 8): string {
  return `${hex.slice(0, n)}…${hex.slice(-n)}`;
}
