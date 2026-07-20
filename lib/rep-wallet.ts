// Custodial key/wallet service (roadmap §7). For the PoC keys are generated and
// held server-side; the user never sees a seed phrase and only ever taps "Allow".
// Production hardening = non-custodial / MPC (stated as a real trust tradeoff).
//
// Two keys per identity: an Ed25519 signing key (attestations & consent) and an
// X25519 encryption key (packages are encrypted to it). Stored as DER base64.
import crypto from "node:crypto";
import type { RepWallet } from "./rep-types";

const NETWORK = (process.env.HEDERA_NETWORK as "testnet" | "mainnet") || "testnet";

const spki = (k: crypto.KeyObject) => k.export({ type: "spki", format: "der" }).toString("base64");
const pkcs8 = (k: crypto.KeyObject) => k.export({ type: "pkcs8", format: "der" }).toString("base64");
const pubObj = (b64: string) => crypto.createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
const privObj = (b64: string) => crypto.createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });

/** A short, stable "0.0.x"-style identity derived from the signing key — the
 *  shared identity used across both on-chain worlds (attestations + registry). */
function deriveAddress(signPubDerB64: string): string {
  const h = crypto.createHash("sha256").update(signPubDerB64).digest("hex");
  return `0.0.${parseInt(h.slice(0, 8), 16) % 9_000_000 + 1_000_000}`;
}

export function createRepWallet(): RepWallet {
  const sign = crypto.generateKeyPairSync("ed25519");
  const enc = crypto.generateKeyPairSync("x25519");
  const signPublicKey = spki(sign.publicKey);
  const address = deriveAddress(signPublicKey);
  return {
    signPublicKey,
    signPrivateKey: pkcs8(sign.privateKey),
    encPublicKey: spki(enc.publicKey),
    encPrivateKey: pkcs8(enc.privateKey),
    address,
    did: `did:hedera:${NETWORK}:${crypto.createHash("sha256").update(signPublicKey).digest("hex").slice(0, 32)}`,
  };
}

/** Sign a message with an identity's Ed25519 key. Returns hex. */
export function signMsg(signPrivateKeyDerB64: string, message: string): string {
  return crypto.sign(null, Buffer.from(message, "utf8"), privObj(signPrivateKeyDerB64)).toString("hex");
}

/** Verify an Ed25519 signature against a known public key. */
export function verifyMsg(signPublicKeyDerB64: string, message: string, sigHex: string): boolean {
  try {
    return crypto.verify(null, Buffer.from(message, "utf8"), pubObj(signPublicKeyDerB64), Buffer.from(sigHex, "hex"));
  } catch {
    return false;
  }
}
