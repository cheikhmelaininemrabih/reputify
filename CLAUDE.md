# Reputify — project notes for Claude

**Reputify** is an investor prototype: *portable reputation infrastructure on Hedera*. It does
**not** score anyone — it gives lenders verifiable facts about a borrower's real financial
activity so the **lender** decides. The real cash-flow data never leaves the borrower's control;
only a cryptographic hash of it is ever written to a public ledger (Hedera Consensus Service).
Single TypeScript codebase, Next.js 14 App Router. Synthetic data only — no real borrowers.

## Commands

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build (must stay green)
npm start          # serve the production build
npm run lint       # next lint
npm run scenarios  # acceptance scenarios against a running dev server (must print ALL SCENARIOS PASS)
```

- **Node 20**, npm 10. Dependencies: `@hashgraph/sdk`, `next`, `react`.
- `npm run scenarios` needs the dev server running (`npm run dev` first) — it drives the real
  `/api/rep/*` endpoints end to end (no browser automation).
- After changing route structure, delete `.next/` before typechecking — stale generated types
  under `.next/types` cause phantom `Cannot find module` errors that aren't real.
- **Do not run `npm run build` while `npm run dev` is running** — they share `.next/`, and the
  production build rewrites webpack chunks the live dev server still references, producing runtime
  `Cannot find module './NNN.js'` errors. If it happens: stop dev, `rm -rf .next`, restart `npm run dev`.
- Only ever run **one** `npm run dev` at a time. If a stray dev server is still holding port 3000,
  Next silently falls back to 3001 and it's easy to end up testing against a stale process. Check
  `lsof -i :3000` / `ps aux | grep next` before starting a new one, and kill by PID if `pkill -f
  "next dev"` doesn't actually catch it (it can miss the `next-server` child process).

## The model (this is the core mental model)

Two decoupled on-chain "worlds" joined by the backend, plus off-chain encrypted data:

1. **Attestation log** (`lib/attestation.ts`) — an append-only HCS topic. A bonded attester signs
   a cash-flow attestation and posts **only its hash** (`RPTFY-ATT|<period>|<hash>`) to Hedera.
   Hedera returns a sequence number + consensus timestamp; that sequence number is the only join
   to the contracts below. Real data never touches the chain.
2. **Contracts, modelled in TS** (`lib/contracts.ts`): `AttesterRegistry` (bond/stake per
   attester), `LoanRegistry` (loans reference the attestation seq numbers they relied on),
   `DisputeResolver` (a fraud challenge that's upheld slashes the lying attester's bond). Solidity
   production reference lives in `/contracts`.
3. **Off-chain package + selective disclosure** (`lib/pkg-crypto.ts`, `lib/disclosure.ts`) — the
   real cash-flow package is encrypted to the borrower's X25519 key (node:crypto ECIES envelope:
   ephemeral key agreement → HKDF → AES-256-GCM) and stored off-chain. A lender's **default** view
   is a plain-language summary only (`lib/reputation.ts` — "3 providers connected · 6 months of
   history · 2 loans repaid on time", never raw numbers). To see the underlying package, the
   lender calls `requestDisclosure()`; nothing releases until the borrower taps Allow
   (`decideDisclosure`). Once allowed, `lenderGranularView()` decrypts the package **and
   independently re-hashes it against the attestation's on-chain hash** (`verifyOnReceipt`) — only
   a match shows "Verified ✓". This is the whole point of anchoring: the data stays private, but
   tampering with it (by the backend, a compromised DB, anyone) is detectable without ever
   exposing it publicly.

## Roles are separated per browser tab (`components/identity.ts`)

Identity is `sessionStorage`-scoped, not a cookie — `sessionStorage` is per top-level browsing
context (tab/window), so a borrower tab and a lender tab open side by side in the *same browser*
stay fully independent and simultaneous, each polling and updating live, instead of one stomping
the other's identity the way a shared cookie would (that was the first version of this — wrong;
fixed after user feedback). Within a single tab it's still one role at a time: `getIdentity()` /
`setIdentity()` / `clearIdentity()` read/write a `rep_identity` key holding `{role, id, name}`, no
server round-trip needed since there are no passwords — picking an identity just means selecting
it from an already-fetched list. Each of `/borrower /lender /attester` shows its own sign-in/
register flow whenever the tab's stored identity doesn't match that page's role (no blocking
screen anymore — just sign in as whatever this tab needs). `components/RepNav.tsx` shows the
current tab's identity + a Sign out button. This is a **UI-level convenience, not a hardened
authorization layer** — the underlying `/api/rep/*` endpoints still trust whatever id is passed to
them (same PoC trust boundary as elsewhere: e.g. the disputes endpoint doesn't check the caller is
really the loan's lender), and `scripts/scenarios.mjs` calls those endpoints directly, bypassing
identity entirely.

**Live polling**: `/borrower`, `/wallet`, `/lender`, and `/attester` each poll their own data every 4s
(`setInterval`, cleaned up on unmount) so activity in one tab — a lender's disclosure request, a
borrower's approval, a newly-minted attestation, a ruled dispute — shows up in every other open
tab without a manual refresh. The same poll also self-heals a stale identity: if "Reset demo data"
wiped the entity a tab's `rep_identity` points at, the next poll notices it's gone, clears it, and
falls back to the sign-in flow instead of rendering a blank page (this exact bug shipped once —
worth remembering: any reset flow must account for stale client-side state, not just server data).

## Routes

All four app pages share `components/RepNav.tsx` (topbar linking `/borrower /lender /attester
/rep`, current page bolded, current signed-in identity + Sign out) so none of them are navigational
dead ends.

| Route | Who | Notes |
|---|---|---|
| `/` | marketing/investor landing | links to the four surfaces below |
| `/borrower` | borrower app | onboard (name/phone/`personhoodId` — one identity per person, anti-Sybil) → **KYC gate** (real webcam ID photo + live selfie, compared client-side with face-api.js — see below) → *request* a provider connection → **Documents tab** (upload ownership/utility-bill files, anchored the same way as cash-flow data) → see plain-language standing → approve/deny lender disclosure requests. Chain is invisible here. **Cannot approve its own connection requests** — see `/wallet`. |
| `/wallet` | mobile-money wallet — **a genuinely separate app** | sign in as a wallet (provider + phone, nothing to do with being a Reputify borrower), see a real balance, **add transactions by hand** (amount/description/category — this is the actual data a cash-flow package is built from once connected, `lib/wallets.ts` `packageFromWallet`), and — the only place this can happen — **authorize a pending connection request**. Reached via a link the borrower app hands out (`/wallet?authorize=<connectionId>`), same as a real OAuth redirect. |
| `/lender` | lender dashboard | search a borrower, see the free summary, request granular access, **subscribe** (static/mock — no real billing, just flips a flag; gates the granular view even after the borrower has allowed disclosure), verify (with a "View on Hedera" link per package/document, straight to the real mirror-node record), issue loans, **raise a fraud dispute** on a defaulted loan (evidence note + submit, inline with the loan row) |
| `/attester` | attester ops + **marketplace** | bond, accreditation, and real track record per attester (attestations posted, disputes raised/upheld against them — bond size alone isn't the trust signal, an upheld dispute is) + the arbiter's dispute queue |
| `/rep` | live status hub | mode (live/simulated) + counts, "Reset demo data" button |

APIs: `app/api/rep/*` (all of the above), plus `app/api/chat` (OpenAI help chatbot, no account
data access — `lib/openai.ts`).

### KYC (`lib/kyc.ts`, `components/KycCapture.tsx`)

Real webcam capture (`getUserMedia`) of an ID document photo (or file upload, since not everyone
has one handy) and a **live** selfie (camera only — no upload fallback, that's the liveness
signal), compared in the browser with **face-api.js** — genuine face detection, 68-point landmarks,
and a 128-d descriptor + Euclidean distance, not a mocked score. Model weights live in
`public/models/` (fetched from the face-api.js-models repo; `tiny_face_detector` +
`face_landmark_68` + `face_recognition`, ~6.8MB total). Threshold is 0.6 (face-api.js's own
documented cutoff); match/no-match is re-derived server-side from the submitted distance
(`lib/kyc.ts` `MATCH_THRESHOLD`) rather than trusting a client-sent boolean — though the
detection/scoring itself necessarily ran client-side (no camera server-side). Both photos are
encrypted-at-rest the same way a cash-flow package is (`pkg-crypto.ts` `encryptFileToBorrower`).
Connecting a provider and uploading documents are both gated on `kyc.status === "verified"`.
Headless testing (`scripts/scenarios.mjs`) submits a synthetic low distance with a trivial 1x1 PNG
— it can't run a browser face model, and the route doesn't require it to. There's also a **"Skip
verification"** button on the KYC gate itself (camera access is flaky on some machines/browsers —
permissions, drivers, no video device at all in some environments) — it submits the same
trivial-PNG-plus-low-distance trick as the headless script, clearly logged as skipped in the audit
trail rather than silently pretending a real comparison happened.

### Documents (`lib/documents.ts`)

Same off-chain pattern as a cash-flow package, generalized: encrypt the file to the borrower's own
key (`pkg-crypto.ts` `encryptFileToBorrower`/`fileHash` — byte-accurate hashing, not the JSON
`canonical()` used for packages), store the ciphertext in `rdb.files`, anchor only the hash as an
attestation (`type: "document"`, extending `AttestationMsg.type` alongside `"throughput"`). Signed
by the **borrower's own** identity key, not a bonded attester's — there's no third party to slash
for a document you upload yourself; this proves tamper-evidence, not third-party-verified accuracy.

### Lender subscription (`lib/billing.ts`)

Static/mock by explicit request — no payment processor. `subscribe()`/`isSubscribed()` just flip a
flag in `rdb.lenderSubs`. The free tier is always the plain-language summary; a subscription is
what unlocks verified, granular, on-chain-checked detail once a borrower has *also* separately
allowed disclosure — two independent gates (`lib/disclosure.ts` `lenderGranularView` checks both).

### Wallets (`lib/wallets.ts`) — the fourth app, and where "static data" actually goes

Added on explicit user feedback: "the wallets need to be their own app, a user needs to authorize
from inside his wallet." A `WalletAccount` (provider + phone + name) has nothing to do with being
a Reputify borrower — it's a fully separate identity (4th role in `components/identity.ts`).

- **Requesting ≠ approving.** `connectProvider` (borrower side) only ever creates a `"pending"`
  `Connection`. Approving one is deliberately **not exposed** on the borrower connections route —
  `POST /api/rep/borrowers/[id]/connections` rejects `approve: true` outright. The only way a
  connection becomes `"approved"` is `POST /api/rep/wallets/[id]/authorize`, which also stamps
  `Connection.walletId`. This mirrors real OAuth: you grant access from inside the provider you're
  trusting, not from inside the app asking for it.
- **The handoff**: the borrower app shows "Open my {provider} wallet to authorize ↗" —
  `/wallet?authorize=<connectionId>` — meant to be opened in a new tab (`target="_blank"`), same
  multi-tab-simultaneous model as the rest of the app. The wallet page reads the `authorize` query
  param, fetches that one connection's public details (`GET /api/rep/connections/[id]` — provider,
  scope, requesting borrower's name), and shows an Allow/Deny panel for exactly that request.
- **Real "static data"**: a wallet owner adds transactions by hand (amount, sign = direction,
  description, category) — `addTransaction` in `lib/wallets.ts`. This is genuinely what drives the
  cash-flow package: `lib/minting.ts` `mintOne` checks `connection.walletId` and, if that wallet has
  entered transactions for the period being minted, builds the `GranularPackage` from those real
  numbers (`packageFromWallet` — derived math, no randomness). If the wallet has nothing for that
  period, it falls back to the synthetic `mock-psp.ts` generator (demo convenience, and what
  `scripts/scenarios.mjs` relies on — its wallets are opened but never given transactions, so
  minting there is 100% synthetic fallback, same behavior as before this feature existed).

## Architecture (`lib/`)

- `rep-db.ts` — persistent JSON store at `.data/rep-db.json`, `globalThis` singleton, debounced
  saves. Schema: `borrowers, attesters, connections, packages, loans, challenges, disclosures,
  personhoods, attestations, audit`.
- `rep-types.ts` — all domain types for this module.
- `rep-service.ts` — borrower onboarding (binds `personhoodId`, blocks re-enrollment — the
  Sybil-resistance check), custodial signing/sealing token.
- `rep-wallet.ts` — per-borrower/attester custodial Ed25519 signing key.
- `attestation.ts` — submit + read attestations. **Simulated by default** (monotonic seq minted
  locally); **live** when `HEDERA_OPERATOR_ID` + `HEDERA_OPERATOR_KEY` are set, via `hcs-live.ts`.
  A failed live submit logs `[hedera] live attestation submit failed...` and falls back to
  simulated rather than erroring the request.
- `hcs-live.ts` — the real HCS client (only imported when credentials are set, so the SDK's
  network client never loads in simulated mode). Creates + caches a topic on first submit; logs
  `[hedera] created attestation topic <id>` once — **pin that as `HEDERA_ATTEST_TOPIC_ID`** or a
  new topic gets created on every dev-server restart.
- `contracts.ts` — `AttesterRegistry` / `LoanRegistry` / `DisputeResolver`, modelled in TS.
- `mock-psp.ts` — fake OAuth connect + deterministic synthetic cash-flow summaries (seeded PRNG,
  so a borrower's data is stable across runs); `fabricate: true` models a lying attester.
- `minting.ts` — the job that pulls PSP summaries and submits attestations for a borrower.
- `pkg-crypto.ts` — X25519+AES-256-GCM envelope encryption/decryption + `verifyOnReceipt` hash
  check. `crypto.ts` has the shared chain-agnostic `canonical()` / `sha256Hex()` helpers only.
- `disclosure.ts` — request/approve/deny + the lender's granular (verified) view.
- `reputation.ts` — the plain-language summary assembly. **Never** returns a hash, timestamp, or
  raw cash-flow figure — those require going through `disclosure.ts`.
- `rep-present.ts` — public DTO shaping (no private keys, no raw figures) for the `/rep` state
  endpoint; `publicAttester` also computes real track-record stats (attestations, disputes
  raised/upheld) for the attester marketplace.
- `kyc.ts` — see KYC section below. `documents.ts` — see Documents section below. `billing.ts` —
  see Lender subscription section below.

## Conventions

- **Client → API**: the `api(path, body?)` helper in `components/api.ts` (GET when no body; throws
  the server's `error` string on non-2xx). Money formatting: `ngn(n)`.
- **API routes** return `{ error }` with a 4xx on failure.
- Shared UI: `HelpChat` floating widget (root layout). Form inputs use `.inp`; buttons use `.btn`
  variants (`gold`, `teal`, `primary`, `ghost`). Global styles + CSS vars in `app/globals.css` —
  `/borrower` `/lender` `/attester` `/rep` all reuse the same `.card` / `.pill` / `.wrap` classes
  as the landing page rather than a shared header component; there isn't one currently.
- **Never anchor or log personal data** — only hashes. Keep the "raw data never leaves the
  borrower's control" invariant intact in any change touching disclosure/reputation flows.

## Anchoring: simulated vs live

Default is **simulated** — attestations get a locally-minted sequence number, nothing is
submitted, `/rep`'s mode pill shows `simulated`. To go live: create a Hedera **testnet** account
at portal.hedera.com and set `HEDERA_OPERATOR_ID` + `HEDERA_OPERATOR_KEY` in `.env.local`. First
attestation after that creates a topic (or reuses `HEDERA_ATTEST_TOPIC_ID` if pinned) and every
attestation becomes a real HCS message, independently readable by anyone via the public mirror
node: `https://testnet.mirrornode.hedera.com/api/v1/topics/<topicId>/messages`. That mirror-node
read is exactly what `verifyOnReceipt` / the lender's "Verified ✓" is built on.

## Status / notes

- Git repo, GitHub remote `cheikhmelaininemrabih/reputify` (public, branch `main`). `.gitignore`
  excludes `.env*.local`, `/.data` (runtime store holds Ed25519 signing keys — never commit),
  `/node_modules`, `/.next`.
- **2026-07-20**: retired the older score-first "Credit Passport" system entirely (signup/login,
  KYC, `/wallet` provider portals, `/bank` applicant pool, 300–850 logistic score, AI fraud
  verdict) — it handed lenders a score plus raw numbers directly with no consent gate or on-chain
  verification, which was the opposite of the product thesis. The attestation/disclosure module
  (previously an isolated add-on) is now the entire product. `/` was rewritten to describe this
  model instead of the old three-systems pitch.
