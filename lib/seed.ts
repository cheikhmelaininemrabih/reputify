// Seed synthetic loan applicants so a bank has a realistic pool to review.
// Each applicant is a full Reputify user: wallet + DID, KYC nullifier, a linked
// mobile-money history, a scored Passport, and a consent granted to the bank.
import { db, save, recordAnchor } from "./db";
import { newId } from "./auth";
import { createWallet, didCommitment } from "./wallet";
import { generateHistory } from "./provider-data";
import { buildPassport } from "./passport";
import { issueConsent } from "./consent";
import { anchorCommitment } from "./hedera";
import { sybilNullifier } from "./crypto";
import type { EarnerProfile, ProviderAccount, ProviderId, RemiUser } from "./models";

const FIRST = ["Amara", "Tunde", "Ngozi", "Chidi", "Bola", "Emeka", "Fatima", "Yusuf", "Zainab", "Ifeoma", "Musa", "Adaeze", "Kunle", "Halima", "Obi", "Segun", "Aisha", "Chioma", "Bashir", "Grace"];
const LAST = ["Okafor", "Adeyemi", "Eze", "Bello", "Okonkwo", "Ibrahim", "Nwosu", "Abubakar", "Oladipo", "Danjuma", "Mohammed", "Uche", "Balogun", "Sani", "Chukwu"];
const PROFILES: EarnerProfile[] = ["trader", "salaried", "gig", "farmer"];
const PROVIDERS_ID: ProviderId[] = ["opay", "moniepoint", "palmpay"];
const HMAC = process.env.REMI_HMAC_SECRET || "remi-dev-secret-change-me";

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

export async function seedApplicants(bankAudience: string, n: number): Promise<number> {
  let created = 0;
  for (let i = 0; i < n; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const profile = pick(PROFILES);
    const injectLoop = Math.random() < 0.15;
    const wallet = createWallet();
    const user: RemiUser = {
      id: newId("usr"), phone: `+2348${Math.floor(1e7 + Math.random() * 8e7)}`, name,
      passwordHash: "seed", salt: "seed", createdAt: new Date().toISOString(), wallet,
      kyc: { status: "verified", fullName: name, level: "full", verifiedAt: new Date().toISOString(), nullifier: sybilNullifier(newId("nin"), HMAC) },
      linked: [],
    };
    db.users[user.id] = user;
    recordAnchor(await anchorCommitment(didCommitment(wallet), "did", wallet.did));

    // Provider account with history (+ occasional betting to vary gambling exposure).
    const paId = newId("pa");
    const { txns, balance } = generateHistory(profile, paId, 5, injectLoop);
    if (Math.random() < 0.35) {
      let bal = balance;
      const bets = 2 + Math.floor(Math.random() * 4);
      for (let b = 0; b < bets; b++) { const amt = 20000 + Math.floor(Math.random() * 60000); bal = Math.max(0, bal - amt); txns.push({ id: newId("tx"), ts: new Date(Date.now() - b * 3600_000).toISOString(), channel: "betting", amount: -amt, counterparty: "BetKing", balanceAfter: bal }); }
    }
    const acct: ProviderAccount = { id: paId, provider: pick(PROVIDERS_ID), phone: user.phone, name, passwordHash: "seed", salt: "seed", profile, createdAt: new Date().toISOString(), balance, txns, grants: [{ token: paId, audience: "remi", issuedAt: new Date().toISOString(), scope: ["transactions:read"] }] };
    db.providerAccounts[paId] = acct;
    user.linked.push({ provider: acct.provider, providerAccountId: paId, accessToken: paId, handle: user.phone, linkedAt: new Date().toISOString() });

    const passport = buildPassport(user, txns);
    db.passports[passport.passportId] = passport;
    user.passportId = passport.passportId;
    recordAnchor(await anchorCommitment(passport.commitment, "passport", passport.passportId));

    const consent = issueConsent(user, passport, bankAudience);
    db.consents[consent.consentId] = consent;
    recordAnchor(await anchorCommitment(consent.commitment, "consent", consent.consentId));
    created++;
  }
  save();
  return created;
}
