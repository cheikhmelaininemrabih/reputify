// Shared helpers: anchor a commitment on Hedera (record + audit), and pull the
// transactions from a user's linked mobile-money accounts (the connector tunnel).
import { anchorCommitment } from "./hedera";
import { db, recordAnchor, audit } from "./db";
import type { AnchorKind, Anchor } from "./types";
import type { ProviderTxn, RemiUser } from "./models";

export async function anchor(kind: AnchorKind, subjectId: string, commitment: string, actor = "Reputify ledger"): Promise<Anchor> {
  const a = await anchorCommitment(commitment, kind, subjectId);
  recordAnchor(a);
  audit({
    system: "ledger",
    actor,
    action: a.broadcast ? `anchored ${kind} on Hedera ${a.network}net` : `anchored ${kind} (simulated)`,
    subject: subjectId,
    anchorTxid: a.txid,
  });
  return a;
}

/** Read transactions from every linked provider account, validating each grant. */
export function pullLinkedTxns(user: RemiUser): { txns: ProviderTxn[]; sources: { provider: string; handle: string; count: number }[] } {
  const all: ProviderTxn[] = [];
  const sources: { provider: string; handle: string; count: number }[] = [];
  for (const link of user.linked) {
    const acct = db.providerAccounts[link.providerAccountId];
    if (!acct) continue;
    const grant = acct.grants.find((g) => g.token === link.accessToken);
    if (!grant) continue; // access revoked
    all.push(...acct.txns);
    sources.push({ provider: acct.provider, handle: link.handle, count: acct.txns.length });
  }
  all.sort((a, b) => a.ts.localeCompare(b.ts));
  return { txns: all, sources };
}
