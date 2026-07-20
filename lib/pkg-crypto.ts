// Off-chain package cryptography (roadmap §5), built on node:crypto only — no
// libsodium, to stay on the existing stack. "Encrypt-to-borrower" is an X25519
// ECIES envelope (ephemeral key agreement → HKDF → AES-256-GCM), which is the
// node:crypto equivalent of a libsodium sealed box.
import crypto from "node:crypto";
import { canonical, sha256Hex } from "./crypto";
import type { EncryptedFile, EncryptedPackage, GranularPackage } from "./rep-types";

/** SHA-256 over the canonical (stable-key-order) serialization. This hash is
 *  what gets anchored as an attestation; the plaintext never goes on-chain. */
export function packageHash(pkg: unknown): string {
  return sha256Hex(canonical(pkg));
}

function pubKeyObj(derB64: string) {
  return crypto.createPublicKey({ key: Buffer.from(derB64, "base64"), format: "der", type: "spki" });
}
function privKeyObj(derB64: string) {
  return crypto.createPrivateKey({ key: Buffer.from(derB64, "base64"), format: "der", type: "pkcs8" });
}

/** Encrypt a package to a borrower's X25519 public key. Output is pure ciphertext
 *  plus the ephemeral public material needed to decrypt — safe to store on an
 *  untrusted host. */
export function encryptToBorrower(
  pkg: GranularPackage,
  borrowerEncPubDerB64: string,
  meta: { uri: string; ownerBorrowerId: string; period: string; provider: string },
): EncryptedPackage {
  const eph = crypto.generateKeyPairSync("x25519");
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: pubKeyObj(borrowerEncPubDerB64) });
  const key = Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.alloc(0), Buffer.from("reputify-pkg-v1"), 32));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(canonical(pkg), "utf8"), cipher.final()]);
  return {
    uri: meta.uri,
    ownerBorrowerId: meta.ownerBorrowerId,
    hash: packageHash(pkg),
    ephPublicKey: eph.publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ct.toString("base64"),
    period: meta.period,
    provider: meta.provider,
  };
}

/** Decrypt with the borrower's X25519 private key (custodial wallet does this on
 *  the borrower's behalf; in production the wallet holds the key). Returns the
 *  original granular package. */
export function decryptPackage(blob: EncryptedPackage, borrowerEncPrivDerB64: string): GranularPackage {
  const shared = crypto.diffieHellman({
    privateKey: privKeyObj(borrowerEncPrivDerB64),
    publicKey: pubKeyObj(blob.ephPublicKey),
  });
  const key = Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.alloc(0), Buffer.from("reputify-pkg-v1"), 32));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(blob.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(pt.toString("utf8"));
}

/** Lender-side verification (roadmap §5 "verify-on-receipt"): re-hash the received
 *  plaintext and confirm it matches the hash that was anchored on-chain. */
export function verifyOnReceipt(pkg: GranularPackage, onChainHash: string): boolean {
  return packageHash(pkg) === onChainHash;
}

/** SHA-256 over raw bytes (base64-encoded input) — used for files/photos, where
 *  the hash must be over the actual bytes, not a canonical JSON serialization.
 *  (sha256Hex from ./crypto takes a utf8 string, which would corrupt binary
 *  data — hash the decoded Buffer directly instead.) */
export function fileHash(base64Data: string): string {
  return crypto.createHash("sha256").update(Buffer.from(base64Data, "base64")).digest("hex");
}

/** Same X25519 envelope as encryptToBorrower, but over arbitrary bytes (a photo,
 *  a scanned document) instead of a GranularPackage. */
export function encryptFileToBorrower(
  base64Data: string,
  borrowerEncPubDerB64: string,
  meta: { uri: string; ownerBorrowerId: string; filename: string; mime: string },
): EncryptedFile {
  const raw = Buffer.from(base64Data, "base64");
  const eph = crypto.generateKeyPairSync("x25519");
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: pubKeyObj(borrowerEncPubDerB64) });
  const key = Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.alloc(0), Buffer.from("reputify-file-v1"), 32));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(raw), cipher.final()]);
  return {
    uri: meta.uri,
    ownerBorrowerId: meta.ownerBorrowerId,
    hash: fileHash(base64Data),
    ephPublicKey: eph.publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ct.toString("base64"),
    filename: meta.filename,
    mime: meta.mime,
  };
}

/** Decrypt a file blob back to base64 bytes with the borrower's X25519 private key. */
export function decryptFile(blob: EncryptedFile, borrowerEncPrivDerB64: string): string {
  const shared = crypto.diffieHellman({
    privateKey: privKeyObj(borrowerEncPrivDerB64),
    publicKey: pubKeyObj(blob.ephPublicKey),
  });
  const key = Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.alloc(0), Buffer.from("reputify-file-v1"), 32));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(blob.ciphertext, "base64")), decipher.final()]);
  return pt.toString("base64");
}
