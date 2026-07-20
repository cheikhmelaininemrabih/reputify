// Lender subscription gate — static/mock by explicit request, no real payment
// processor wired up. "Subscribe" just flips a flag. The free tier is always the
// plain-language summary (lib/reputation.ts); a subscription is what unlocks the
// verified, granular, on-chain-checked detail once a borrower has also allowed it.
import { rdb, rsave, raudit } from "./rep-db";
import type { LenderSub } from "./rep-types";

const PLAN = "verified-detail";

export function isSubscribed(lenderId: string): boolean {
  return !!rdb.lenderSubs[lenderId]?.active;
}

export function getSubscription(lenderId: string): LenderSub | null {
  return rdb.lenderSubs[lenderId] ?? null;
}

export function subscribe(lenderId: string): LenderSub {
  const sub: LenderSub = { lenderId, active: true, plan: PLAN, since: new Date().toISOString() };
  rdb.lenderSubs[lenderId] = sub;
  rsave();
  raudit({ actor: lenderId, action: `subscribed (${PLAN})`, subject: lenderId });
  return sub;
}

export function unsubscribe(lenderId: string): void {
  if (rdb.lenderSubs[lenderId]) {
    rdb.lenderSubs[lenderId].active = false;
    rsave();
    raudit({ actor: lenderId, action: "cancelled subscription", subject: lenderId });
  }
}
