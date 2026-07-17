# Reputify — Portable Credit Identity on Hedera

Three connected systems that turn everyday mobile-money activity into a consented,
on-chain-anchored **Credit Passport** a bank can trust **without seeing the raw data**.

- **Reputify** — users sign up, get a **Hedera wallet + DID (anchored on-chain)**, pass **automatic KYC**
  (attestation + anti-Sybil nullifier anchored), link a mobile-money account, get scored, grant consent.
- **Mobile-money apps** (OPay / Moniepoint / PalmPay) — their *own* portal where a user signs up and gets
  a wallet with a real transaction history. This is where the data lives; Reputify reads it with consent.
- **Bank portal** — banks register, query a consented Passport, and verify it on Hedera.

Single TypeScript codebase (Next.js 14). Real Hedera testnet anchoring via `@bsv/sdk`,
with a clearly-labelled simulated fallback so it always runs.

---

## Run it

```bash
cd ~/remi
npm install
npm run dev            # http://localhost:3000
```

**The full journey (all in the browser):**

1. `/signup` — create a Reputify account. Your **Hedera wallet + DID** are minted and anchored on the spot.
2. On `/dashboard` — run **automatic KYC** (any full name + an 11-digit number).
3. Click **Connect OPay** → you land in the **OPay portal** (`/providers/opay`). Sign up there
   (pick an earner profile — it generates your history), then **Authorize Reputify**.
4. Back on the dashboard — **Build Passport** (Reputify pulls the feed, detects fraud, scores you, anchors it),
   then **Grant consent** and copy the consent ID.
5. `/bank` — register a bank, paste the consent ID, **Query**, then **Verify on-chain**.

Everything persists in `.data/db.json` (survives restarts). `node e2e-shot.mjs` drives the whole
flow headlessly and screenshots it.

### Try the fraud + anti-Sybil paths
- On provider signup, tick **"simulate a suspicious income-loop pattern"** → the Passport flags it and
  discounts the fake inflow (High risk).
- Try KYC twice with the **same national ID** → the second is rejected (one person, one identity).

---

## Make the Hedera anchoring real (testnet)

Anchors are **simulated** by default (a deterministic pseudo txid is produced, nothing is submitted).
To submit for real: create a Hedera testnet account at portal.hedera.com and set `HEDERA_OPERATOR_ID`
+ `HEDERA_OPERATOR_KEY` (and optionally `HEDERA_TOPIC_ID`) in `.env.local` — the chain pill flips to
**live**, each anchor becomes a Hedera Consensus Service topic message with a HashScan link, and the
bank's verify reads it back via the Hedera mirror node.

---

## What gets anchored on Hedera (per user)

Every anchor is a 32-byte commitment published as a Hedera Consensus Service topic message tagged `RPTFY1` — never personal data:

| Anchor | What it proves |
|--------|----------------|
| **DID** | the user's identity document exists & is tamper-evident |
| **KYC** | an identity attestation + anti-Sybil nullifier (HMAC, not a reversible ID hash) |
| **Passport** | the scored credit body, unforgeable |
| **Consent** | a signed, time-boxed grant to a specific bank (non-repudiation) |

The dashboard shows each user's **on-chain ledger** of these anchors.

---

## Architecture

```
lib/
  db.ts          persistent JSON store (prod → Postgres + vault)
  models.ts      RemiUser / ProviderAccount / BankUser
  auth.ts        scrypt passwords + cookie sessions (3 systems)
  wallet.ts      per-user Ed25519 key + did:hedera DID document + signing
  kyc.ts         automatic KYC + anti-Sybil nullifier
  hedera.ts      HCS topic-message anchoring via @hashgraph/sdk (+ simulated fallback)
  ledger.ts      anchor helper + pull-linked-transactions (the connector tunnel)
  provider-data.ts   per-profile transaction-history generator
  features.ts    feature extraction + graph fraud detection
  scoring.ts     logistic PD model → 300–850 score → reason codes
  passport.ts / consent.ts / crypto.ts
app/
  page · signup · login · dashboard          Reputify
  providers/ · providers/[id]                Mobile-money portals
  bank                                        Bank portal
  api/remi/* · api/provider/* · api/bank/* · api/status
```

Synthetic data only — no real borrowers. The scoring model is a transparent stand-in shaped exactly like
the production classifier (features → PD → score), swappable without touching callers.
