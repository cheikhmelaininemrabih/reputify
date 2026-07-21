# Reputify — Portable Reputation Infrastructure on Hedera

Reputify does not score anyone. It gives a lender **verifiable facts** about a borrower's real
financial activity, so the lender forms their own judgment — the same way they would from a real
document, except this one can't be quietly altered after the fact. The borrower's actual cash-flow
data never leaves their control; only a cryptographic hash of it is ever written to a public
ledger (Hedera Consensus Service). A lender's default view is a **plain-language summary only**
("3 providers connected · 6 months of history · 2 loans repaid on time" — never raw numbers).
Seeing anything more detailed requires the borrower to personally approve a disclosure request,
and even then the lender gets a value that's independently re-hashed and checked against the
on-chain record before it's ever shown as *Verified*.

Single TypeScript codebase, Next.js 14 App Router. Synthetic data only — no real borrowers, no
real money. Built as an investor/demo prototype, not a production fintech backend.

---

## Why this exists

Traditional credit scoring hands a bank a single number and trusts the platform that computed it.
That number can be wrong, stale, or manipulated, and the bank has no way to check. Reputify's bet
is that lenders don't actually want a *score* — they want **evidence they can independently
verify**, while the person the data belongs to keeps control of who sees what. Two ideas make that
possible at once:

1. **Selective disclosure.** Nothing about a borrower's real numbers is public by default. A
   lender sees a plain-language summary; anything more granular requires an explicit, revocable
   grant from the borrower.
2. **Tamper-evidence, not secrecy, on-chain.** The chain never sees the real data — only its hash.
   That hash is enough to prove, mathematically, whether the off-chain data a lender is looking at
   is exactly what was originally attested, or has been altered since.

---

## The model

Two decoupled on-chain "worlds," joined by the backend, plus off-chain encrypted data:

1. **Attestation log** — an append-only Hedera Consensus Service (HCS) topic. A bonded attester
   signs a cash-flow attestation and posts *only its hash* to Hedera
   (`RPTFY-ATT|<period>|<hash>`). Hedera returns a sequence number and consensus timestamp — the
   only link back to everything below. Real financial data never touches the chain.
2. **Contracts, modelled in TypeScript** (production Solidity reference lives in `/contracts`):
   - `AttesterRegistry` — bond/stake per attester.
   - `LoanRegistry` — loans reference the exact attestation sequence numbers they relied on.
   - `DisputeResolver` — a fraud challenge that's upheld slashes the lying attester's bond.
3. **Off-chain package + selective disclosure.** The real cash-flow package is encrypted to the
   borrower's own X25519 key (ephemeral ECDH → HKDF → AES-256-GCM) and stored off-chain. To see
   the decrypted package, a lender calls `requestDisclosure()`; nothing releases until the
   borrower taps **Allow**. Once allowed, the lender's view is decrypted **and independently
   re-hashed against the attestation's on-chain hash** — only a match shows **Verified ✓**. That
   check is the entire point of anchoring: the data stays private, but any tampering with it (by
   the backend, a compromised database, anyone) is detectable without the data ever being made
   public.

---

## The four apps

Reputify is deliberately built as four separate surfaces, each with its own identity, because
mixing "the person asking for access" and "the person granting it" into one app is exactly the
kind of ambiguity real OAuth flows are designed to avoid.

| Route | Who | What happens here |
|---|---|---|
| `/borrower` | The borrower | Onboard (name, phone, a `personhoodId` — one identity per person, the anti-Sybil check) → **KYC gate**: a real webcam photo of an ID plus a *live* selfie, compared client-side with `face-api.js` (or a **Skip verification** button, clearly logged as skipped, for machines without a working camera) → request a provider connection → upload owned-asset documents (deed, utility bill, anything) → see plain-language standing → approve or deny lender disclosure requests. The chain is invisible here — nobody deals with hashes or keys in this app. It **cannot** approve its own connection requests. |
| `/wallet` | A mobile-money wallet (OPay, Moniepoint, …) — a genuinely separate app | Sign in as a wallet (provider + phone — nothing to do with being a Reputify borrower), see a real balance, add transactions by hand (amount, description, category — this *is* the actual data a cash-flow package is built from once connected), and — the only place this can happen — **authorize a pending connection request**. Reached via a link the borrower app hands out (`/wallet?authorize=<connectionId>`), the same shape as a real OAuth redirect: you grant access from inside the thing you're trusting, never from inside the app that's asking. |
| `/lender` | A bank / lender | Search a borrower, see the free plain-language summary, request granular access, **subscribe** (static/mock — no real billing, just a flag; gates the detailed view even after the borrower has separately allowed disclosure), verify the data with a **View on Hedera** link straight to the real mirror-node record, issue loans, and raise a fraud dispute on a defaulted loan. |
| `/attester` | Bonded attesters + the marketplace | Bond, accreditation, and a real track record per attester (attestations posted, disputes raised/upheld against them — bond size alone isn't the trust signal, an *upheld dispute* is), plus the arbiter's dispute queue. |
| `/rep` | Anyone | A live status hub — current mode (live/simulated Hedera), entity counts, and a **Reset demo data** button. |

All five pages share one nav header so none of them is a dead end. Identity is
**`sessionStorage`-scoped, not a cookie** — that's what lets a borrower tab and a lender tab sit
side by side in the *same browser window* and stay fully independent, each polling and updating
live every 4 seconds, instead of one identity stomping the other the way a shared cookie would.

---

## Run it

```bash
git clone git@github.com:cheikhmelaininemrabih/reputify.git
cd reputify
npm install
npm run dev        # http://localhost:3000
```

Requires **Node 20** and npm 10. No environment variables are required to run the full demo —
Hedera anchoring and the help chatbot both fall back to clearly-labelled simulated/unconfigured
modes so the app always works end to end offline.

```bash
npm run build      # production build — must stay green
npm start           # serve the production build
npm run lint        # next lint
npm run scenarios   # acceptance scenarios against a running dev server — needs `npm run dev` first
```

`npm run scenarios` drives the real `/api/rep/*` endpoints end to end (no browser automation) and
should print `ALL SCENARIOS PASS`.

### A five-minute walkthrough

1. Open `/borrower`, create an account, complete (or skip) KYC.
2. Request a provider connection (e.g. OPay), then follow the link into `/wallet` — open it in a
   **new tab** — and hit **Allow**. Add a few transactions by hand.
3. Back in `/borrower`, upload a document (any file) under **Documents** — it gets hashed and
   anchored the same way cash-flow data does.
4. Open `/lender` in a third tab, search for your borrower, subscribe, and **Request granular
   access**.
5. Flip back to `/borrower` — the request appears live (polling, no refresh) — **Allow** it.
6. Back in `/lender`, the detailed view now shows **Verified ✓** per period, each with a **View on
   Hedera** link to the real mirror-node record. Issue a loan.
7. Open `/rep` any time to see live counts and the current Hedera mode.

---

## Going live on Hedera

Anchoring is **simulated** by default — attestations get a locally-minted sequence number, nothing
is submitted anywhere, and `/rep`'s mode pill reads `simulated`. To make it real:

1. Create a **testnet** account at [portal.hedera.com](https://portal.hedera.com).
2. Copy `.env.local.example` to `.env.local` and set `HEDERA_OPERATOR_ID` + `HEDERA_OPERATOR_KEY`.
3. Restart the dev server. The first attestation creates an HCS topic (or reuses one if you've
   pinned `HEDERA_ATTEST_TOPIC_ID` — worth doing, otherwise a new topic gets created on every
   restart) and every attestation after that is a real HCS message.

Once live, anyone can independently verify a hash — no Reputify account, no API key — via the
public mirror node:

```
https://testnet.mirrornode.hedera.com/api/v1/topics/<topicId>/messages
```

or the human-readable explorer:

```
https://hashscan.io/testnet/topic/<topicId>
```

That mirror-node read is exactly what powers the app's own `Verified ✓` badge — it's not a claim
the backend makes about itself, it's a check anyone can rerun.

---

## KYC, for real

`getUserMedia` captures an ID document photo (or a file upload, since not everyone has one handy)
and a **live** selfie — camera only, no upload fallback, since that's the liveness signal — and
compares them in the browser with `face-api.js`: genuine face detection, 68-point landmarks, and a
128-d descriptor distance, not a mocked score. Match/no-match is re-derived **server-side** from
the submitted distance rather than trusted from a client-sent boolean, though the detection itself
necessarily runs client-side (there's no camera on the server). Both photos are encrypted at rest
the same way a cash-flow package is. Connecting a provider and uploading documents are both gated
on KYC being verified.

---

## Architecture

```
lib/
  rep-db.ts          persistent JSON store (.data/rep-db.json), debounced saves
  rep-types.ts        all domain types
  rep-service.ts       borrower onboarding, personhoodId binding (anti-Sybil)
  rep-wallet.ts        per-borrower/attester custodial Ed25519 signing key
  attestation.ts       submit + read attestations — simulated by default, live via hcs-live.ts
  hcs-live.ts           the real Hedera Consensus Service client
  contracts.ts          AttesterRegistry / LoanRegistry / DisputeResolver, modelled in TS
  mock-psp.ts            fake OAuth connect + deterministic synthetic cash-flow (seeded PRNG)
  wallets.ts              the 4th app — real hand-entered transactions, connection authorization
  minting.ts               pulls real wallet data (or synthetic fallback) and submits attestations
  pkg-crypto.ts             X25519 + AES-256-GCM envelope encryption, verifyOnReceipt hash check
  disclosure.ts              request/approve/deny + the lender's granular verified view
  reputation.ts               plain-language summary — never a hash, timestamp, or raw figure
  kyc.ts / documents.ts / billing.ts   KYC, document anchoring, static lender subscription
app/
  page.tsx                landing page — links to all four apps
  borrower/ wallet/ lender/ attester/ rep/     the five surfaces above
  api/rep/*                all backing endpoints
  api/chat                 OpenAI help chatbot — no account data access
```

Synthetic data only. Everything persists to `.data/rep-db.json` and survives restarts; the
`Reset demo data` button on `/rep` wipes it back to empty.

---

## Status

Public repo, `main` branch. `.gitignore` excludes `.env*.local` and `/.data` (the runtime store
holds Ed25519 signing keys — never commit it). The product went through one major pivot: an
earlier score-first "Credit Passport" system (signup/login, a 300–850 logistic score, an AI fraud
verdict) was retired entirely in favor of the attestation/disclosure model described above, which
handed lenders verifiable facts with a real consent gate instead of a number with none.
