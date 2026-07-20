// Orchestration layer (roadmap §8) — the "glue" between the two on-chain worlds,
// the off-chain store, and the (mock) PSP. Higher-level onboarding used by the
// API routes and the acceptance-scenario harness.
import crypto from "node:crypto";
import { createRepWallet } from "./rep-wallet";
import { mockOAuthConnect } from "./mock-psp";
import { AttesterRegistry } from "./contracts";
import { PARAMS } from "./rep-types";
import { rdb, rsave, raudit } from "./rep-db";
import type { Attester, Borrower, Connection } from "./rep-types";

// PSP tokens are held server-side "encrypted at rest" (roadmap §6). PoC uses a
// dev-derived key; production = KMS-managed key.
const TOKEN_KEY = crypto.createHash("sha256").update(process.env.REP_SECRET || "reputify-dev-secret").digest();
function sealToken(t: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", TOKEN_KEY, iv);
  const ct = Buffer.concat([c.update(t, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

/** Onboard a borrower: mint a custodial wallet + bind personhood (anti-Sybil). */
export function onboardBorrower(input: { name: string; phone: string; personhoodId: string }): Borrower {
  if (!input.name || !input.phone || !input.personhoodId) {
    throw new Error("name, phone and personhoodId are required");
  }
  if (rdb.personhoods[input.personhoodId]) {
    throw new Error("This person is already enrolled — one identity per person (anti-Sybil)");
  }
  const wallet = createRepWallet();
  const b: Borrower = {
    id: `bwr_${crypto.randomBytes(6).toString("hex")}`,
    name: input.name, phone: input.phone, wallet,
    personhoodId: input.personhoodId, createdAt: new Date().toISOString(),
  };
  rdb.borrowers[b.id] = b;
  rdb.personhoods[input.personhoodId] = b.id;
  rsave();
  raudit({ actor: b.name, action: "onboarded + wallet minted", subject: b.id });
  return b;
}

/** Connect a mobile-money provider = standing consent (revocable OAuth token). */
export function connectProvider(borrowerId: string, provider: Connection["provider"]): Connection {
  const b = rdb.borrowers[borrowerId];
  if (!b) throw new Error("unknown borrower");
  const { token, scope } = mockOAuthConnect(provider);
  const conn: Connection = {
    id: `con_${crypto.randomBytes(6).toString("hex")}`,
    borrowerId, provider, tokenEnc: sealToken(token), scope,
    connectedAt: new Date().toISOString(),
  };
  rdb.connections[conn.id] = conn;
  rsave();
  raudit({ actor: b.name, action: `connected ${provider}`, subject: borrowerId });
  return conn;
}

export function revokeConnection(connectionId: string): Connection {
  const c = rdb.connections[connectionId];
  if (!c) throw new Error("unknown connection");
  c.revoked = true;
  rsave();
  raudit({ actor: c.borrowerId, action: `revoked ${c.provider}`, subject: c.borrowerId });
  return c;
}

/** Register + accredit an attester with a custodial signing key. */
export function onboardAttester(input: { name: string; stake: number }): Attester {
  const wallet = createRepWallet();
  const a = AttesterRegistry.registerAttester(
    wallet.address, input.name,
    { signPublicKey: wallet.signPublicKey, signPrivateKey: wallet.signPrivateKey },
    input.stake,
  );
  AttesterRegistry.accredit(a.address);
  return a;
}

/** Ensure at least one accredited attester exists (used by the mint convenience). */
export function ensureDefaultAttester(): Attester {
  const existing = Object.values(rdb.attesters).find((a) => a.accredited);
  return existing ?? onboardAttester({ name: "MarsaAttest", stake: PARAMS.minBond * 5 });
}
