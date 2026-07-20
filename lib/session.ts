// Browser-level role separation: a single session cookie holds exactly one
// {role, id} at a time, so the same browser can't act as a borrower and a
// lender (or attester) simultaneously — signing in as one role requires
// signing out of whichever role is already active. This is a UI-level
// safeguard against casual self-dealing in the demo, not a hardened
// authorization layer: the underlying /api/rep/* endpoints still trust the
// ids passed to them (same "PoC simplification" trust boundary documented
// elsewhere in this app — e.g. disputes doesn't check the caller is really
// the loan's lender). No passwords, same as borrowers/attesters.
import { cookies } from "next/headers";

export type Role = "borrower" | "lender" | "attester";
export interface Session { role: Role; id: string; name: string }

const COOKIE = "rep_session";

export function readSession(): Session | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s && typeof s.role === "string" && typeof s.id === "string" && typeof s.name === "string") return s as Session;
    return null;
  } catch {
    return null;
  }
}

export function writeSession(s: Session) {
  cookies().set(COOKIE, JSON.stringify(s), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}
