// The periodic minting job (roadmap §6/§8). Standing consent → deliver up front:
// for each connected borrower, each period, pull the PSP summary, build the
// granular package, hash it, encrypt-to-borrower, deposit the ciphertext blob,
// and anchor the hash as an HCS attestation. Never fetched at loan time.
import { fetchSummary, recentPeriods } from "./mock-psp";
import { encryptToBorrower } from "./pkg-crypto";
import { submitAttestation } from "./attestation";
import { rdb, rsave } from "./rep-db";
import type { AttestationMsg, Attester, Connection, EncryptedPackage } from "./rep-types";

interface MintResult {
  attestation: AttestationMsg;
  blob: EncryptedPackage;
}

/** Mint one attestation for one connection + period. `fabricate` models a lying
 *  attester posting an inflated package (used by the fraud demo scenario). */
export async function mintOne(
  attester: Attester,
  connection: Connection,
  period: string,
  fabricate = false,
): Promise<MintResult> {
  const borrower = rdb.borrowers[connection.borrowerId];
  if (!borrower) throw new Error("unknown borrower");

  // 1. Pull the (mock) PSP summary and build the package.
  const pkg = fetchSummary(borrower.id, connection.provider, period, { fabricate });

  // 2. Encrypt-to-borrower and deposit the ciphertext blob in the off-chain store.
  const uri = `blob://${borrower.id}/${connection.provider}/${period}`;
  const blob = encryptToBorrower(pkg, borrower.wallet.encPublicKey, {
    uri, ownerBorrowerId: borrower.id, period, provider: connection.provider,
  });
  rdb.packages[uri] = blob;
  rsave();

  // 3. Anchor the hash as a signed HCS attestation (World A).
  const attestation = await submitAttestation({
    attester,
    attesterSignPrivKey: attester.signPrivateKey,
    subject: borrower.id,
    period,
    hash: blob.hash,
    packageUri: uri,
  });

  return { attestation, blob };
}

/** Run the monthly job across the last `months` periods for every active
 *  connection of a borrower. */
export async function mintForBorrower(
  attester: Attester, borrowerId: string, months = 6, endPeriod = defaultPeriod(), fabricate = false,
): Promise<MintResult[]> {
  const conns = Object.values(rdb.connections).filter((c) => c.borrowerId === borrowerId && !c.revoked);
  const out: MintResult[] = [];
  for (const conn of conns) {
    for (const period of recentPeriods(endPeriod, months)) {
      out.push(await mintOne(attester, conn, period, fabricate));
    }
  }
  return out;
}

export function defaultPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
