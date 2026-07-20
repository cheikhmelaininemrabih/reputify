// Hashing helpers. Uses Node's crypto so hashes are the same bytes regardless
// of the anchoring chain (SHA-256 is chain-agnostic).
import { createHash } from "node:crypto";

/** Deterministic JSON: stable key order so a hash is reproducible. */
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
