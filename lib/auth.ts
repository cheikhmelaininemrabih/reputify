// Authentication: salted scrypt password hashing + cookie sessions.
// One helper set shared by all three systems (Reputify / provider / bank).
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, save } from "./db";
import type { Session } from "./models";

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const cand = scryptSync(password, salt, 32);
  const known = Buffer.from(hash, "hex");
  return cand.length === known.length && timingSafeEqual(cand, known);
}

const COOKIE: Record<Session["kind"], string> = {
  remi: "remi_session",
  provider: "provider_session",
  bank: "bank_session",
};

const TTL_MS = 1000 * 60 * 60 * 12; // 12h

export function createSession(subjectId: string, kind: Session["kind"]): Session {
  const token = randomBytes(24).toString("hex");
  const session: Session = { token, subjectId, kind, expiresAt: Date.now() + TTL_MS };
  db.sessions[token] = session;
  save();
  cookies().set(COOKIE[kind], token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL_MS / 1000,
  });
  return session;
}

export function getSession(kind: Session["kind"]): Session | null {
  const token = cookies().get(COOKIE[kind])?.value;
  if (!token) return null;
  const s = db.sessions[token];
  if (!s || s.expiresAt < Date.now()) return null;
  return s;
}

export function destroySession(kind: Session["kind"]) {
  const token = cookies().get(COOKIE[kind])?.value;
  if (token) { delete db.sessions[token]; save(); }
  cookies().delete(COOKIE[kind]);
}

export function currentRemiUser() {
  const s = getSession("remi");
  return s ? db.users[s.subjectId] ?? null : null;
}
export function currentProviderAccount() {
  const s = getSession("provider");
  return s ? db.providerAccounts[s.subjectId] ?? null : null;
}
export function currentBankUser() {
  const s = getSession("bank");
  return s ? db.bankUsers[s.subjectId] ?? null : null;
}
