// Serializers that shape internal records into safe public payloads.
// Kept out of route.ts files (Next forbids non-handler exports there).
import { analyzeRisk } from "./fraud";
import type { ProviderAccount, RemiUser } from "./models";

export function publicUser(u: RemiUser) {
  return {
    id: u.id, phone: u.phone, name: u.name, createdAt: u.createdAt,
    wallet: { publicKey: u.wallet.publicKey, keyType: u.wallet.keyType, did: u.wallet.did },
    didAnchorTxid: u.didAnchorTxid,
    kyc: { status: u.kyc.status, level: u.kyc.level, verifiedAt: u.kyc.verifiedAt, anchorTxid: u.kyc.anchorTxid, checks: u.kyc.checks ?? [], attestationCommitment: u.kyc.attestationCommitment },
    linked: u.linked.map((l) => ({ provider: l.provider, handle: l.handle, linkedAt: l.linkedAt })),
    passportId: u.passportId,
  };
}

export function publicAccount(a: ProviderAccount) {
  const inflow = a.txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = a.txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  return {
    id: a.id, provider: a.provider, phone: a.phone, name: a.name, profile: a.profile,
    balance: a.balance, txCount: a.txns.length, inflow, outflow,
    recent: [...a.txns].reverse().slice(0, 15),
    grants: a.grants.map((g) => ({ audience: g.audience, issuedAt: g.issuedAt, scope: g.scope })),
    risk: analyzeRisk(a.txns),
  };
}
