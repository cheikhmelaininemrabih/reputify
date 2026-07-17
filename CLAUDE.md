# Reputify — project notes for Claude

**Reputify** is an investor prototype: a *portable credit identity on Hedera*. It turns everyday
mobile-money activity into a consented, on-chain-anchored **Credit Passport** that a bank can
trust without ever seeing the raw transaction data. Single TypeScript codebase, **Next.js 14
App Router**. Synthetic data only — no real borrowers.

## Commands

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build (must stay green)
npm start        # serve the production build
npm run lint     # next lint
npm run e2e      # headless end-to-end run of the whole journey (must print ALL GOOD)
npm run shots    # marketing screenshots: bank console + wallet fraud alert
```

- **Node 20**, npm 10. Dependencies: `@bsv/sdk`, `next`, `react`, `puppeteer-core` (for the e2e).
- `npm run e2e` / `npm run shots` need the dev server running and a Chromium at `/usr/bin/chromium`
  (override with `CHROME_PATH`; base URL via `REMI_BASE_URL`). Screenshots land in `./.data/shots/`
  (override `REMI_SHOTS_DIR`).
- After changing route-group structure, delete `.next/` before typechecking — stale generated
  types under `.next/types` cause phantom `Cannot find module` errors that aren't real.
- **Do not run `npm run build` while `npm run dev` is running** — they share `.next/`, and the
  production build rewrites webpack chunks the live dev server still references, producing runtime
  `Cannot find module './NNN.js'` errors. If it happens: stop dev, `rm -rf .next`, restart `npm run dev`.

## The three systems (this is the core mental model)

Reputify is **three separate account systems** in one app, each with its own login/session cookie.
Reputify links to the others only through **consented access grants** ("tunnels") — raw data never moves.

| System | Who | Routes | Session cookie |
|--------|-----|--------|----------------|
| **Reputify** | credit-identity holders | `/`, `/signup`, `/login`, `/dashboard` (group `app/(remi)`) | `remi_session` |
| **Mobile-money portals** | OPay / Moniepoint / PalmPay users | `/wallet`, `/wallet/[id]` | `provider_session` |
| **Bank / LenderHub** | lenders | `/bank` | `bank_session` |

APIs mirror this split: `app/api/remi/*`, `app/api/provider/*`, `app/api/bank/*`, plus `api/status`.

### End-to-end journey (what the e2e drives)
1. `/signup` → Reputify account created; **Hedera wallet + DID minted and anchored** on the spot.
2. `/dashboard` → run **KYC** (4 steps: identity document → document photo → liveness → review),
   which issues a Verifiable Credential + anti-Sybil nullifier, anchored on Hedera.
3. Connect a provider → land in that wallet portal (`/wallet/opay?connect=1`), sign up, generate
   a transaction history, then **Authorize Reputify**.
4. Back on the dashboard → **Build Passport** (pull consented txns → fraud graph → score → anchor),
   then **Grant consent** (audience `bank:launch`).
5. `/bank` → register a lender; every borrower who granted `bank:launch` consent appears in the
   **applicant pool** with their score and risk signals. The lender approves/declines.

## Architecture (`lib/`)

- `db.ts` — persistent JSON store at `.data/db.json`, held as a `globalThis` singleton, debounced
  saves. Schema: `users, providerAccounts, bankUsers, sessions, passports, consents, anchors,
  anchorsBySubject, nullifiers, decisions, audit`. Prod → Postgres + encrypted vault.
- `models.ts` / `types.ts` — all account & domain types. `PROVIDERS` and `EarnerProfile` live here.
- `auth.ts` — scrypt password hashing (`timingSafeEqual`), 12h cookie sessions, `currentRemiUser()` /
  `currentProviderAccount()` / `currentBankUser()`.
- `wallet.ts` — per-user Hedera key + DID document + signing.
- `kyc.ts` — automatic KYC checks + anti-Sybil nullifier (HMAC, not a reversible ID hash).
- `hedera.ts` — Hedera anchoring. Submits a 32-byte hash as a Hedera Consensus Service (HCS) topic
  message tagged `RPTFY1`. **Simulated by default**; submits to Hedera testnet for real only when
  `HEDERA_OPERATOR_ID` + `HEDERA_OPERATOR_KEY` are set. Never puts personal data on-chain.
- `wallet.ts` — per-user Ed25519 keypair + `did:hedera:<network>:<pubkey>` DID document + signing.
- `ledger.ts` — `anchor()` (anchor + record + audit) and `pullLinkedTxns()` (consent-validated read
  of a user's provider transactions — the connector tunnel).
- `provider-data.ts` / `billers.ts` — per-profile synthetic transaction generator; billers, where
  the `betting` category counts as gambling for the risk engine.
- `features.ts` / `fraud.ts` — feature extraction + graph-based fraud (circular income-loop) detection.
- `scoring.ts` — transparent logistic PD model → 300–850 score + reason codes. Shaped like the
  production classifier and swappable without touching callers.
- `passport.ts` / `consent.ts` / `crypto.ts` / `present.ts` / `seed.ts` — passport assembly,
  signed time-boxed consent receipts, hashing, public DTO shaping, demo seeding.

## Conventions

- **Client → API**: use the `api(path, body?)` helper in `components/api.ts` (GET when no body; throws
  the server's `error` string on non-2xx). Money formatting: `ngn(n)`.
- **API routes** return `{ error }` with a 4xx on failure; guard with the `currentXUser()` helpers.
- Shared UI: `components/AppHeader.tsx` (topbar), `components/AuthShell.tsx` (split-screen auth pages),
  `ScoreDial`, `KycFlow`, `ChainStatus`. Form inputs use the `.inp` class; buttons use `.btn` variants
  (`gold`, `teal`, `primary`, `ghost`). Global styles + CSS vars in `app/globals.css`.
- **Never anchor or log personal data** — only commitments (hashes). Keep the "raw data never leaves
  the borrower's vault" invariant intact in any change touching passport/consent/bank flows.

## Keeping the e2e in sync

`e2e-shot.mjs` drives the real UI by **visible text** (`clickText` / `waitText`). If you rename a
button or step heading, update the matching string in the harness or it will hang at that step.
The full run must print `ALL GOOD` and exit 0. It's the fastest way to confirm a change didn't break
the cross-system journey — run it after any change to signup, KYC, wallet, passport, consent, or bank.

## Anchoring: simulated vs live

Default is **simulated** (a deterministic pseudo txid is produced, nothing is submitted — the chain
pill shows `sim`). To go live: create a Hedera **testnet** account at portal.hedera.com and set
`HEDERA_OPERATOR_ID` + `HEDERA_OPERATOR_KEY` (and optionally `HEDERA_TOPIC_ID`) in `.env.local`. The
pill flips to `live`, each anchor becomes an HCS topic message with a HashScan link, and the bank's
verify reads it back via the Hedera mirror node. `/api/status` reports `network`, `mode`, and `topicId`.

## Status / notes

- Not a git repo. `.data/` (JSON store + shots) and `.next/` are local/regenerable.
- The shell/nav was refactored to shared `AppHeader`/`AuthShell` and `signup`/`login` moved out of the
  `(remi)` route group to top-level `app/`. Build is green; full e2e passes.
