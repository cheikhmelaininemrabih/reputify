// Per-user Hedera identity: an Ed25519 keypair + a Decentralized Identifier (DID).
//
// On signup every Reputify user gets their own Ed25519 keypair. Their DID is
// derived from the public key (did:hedera:<network>:<pubkey>). A DID *document*
// is built off-chain; only its hash is anchored on Hedera (via the Consensus
// Service), giving a tamper-evident, resolvable pointer to the user's identity
// without putting anything personal on-chain. In production the key lives in the
// user's own wallet, never here.
import { PrivateKey } from "@hashgraph/sdk";
import type { Wallet } from "./models";
import { commit } from "./crypto";

const NETWORK = (process.env.HEDERA_NETWORK as "testnet" | "mainnet") || "testnet";

export function createWallet(): Wallet {
  const key = PrivateKey.generateED25519();
  const publicKey = key.publicKey.toStringRaw();
  return {
    privateKey: key.toStringRaw(),
    publicKey,
    keyType: "Ed25519",
    did: `did:hedera:${NETWORK}:${publicKey}`,
  };
}

export function walletKey(wallet: Wallet): PrivateKey {
  return PrivateKey.fromStringED25519(wallet.privateKey);
}

/** W3C-style DID document. Only its hash goes on-chain. */
export function didDocument(wallet: Wallet) {
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/ed25519-2020/v1"],
    id: wallet.did,
    verificationMethod: [
      {
        id: `${wallet.did}#key-1`,
        type: "Ed25519VerificationKey2020",
        controller: wallet.did,
        publicKeyHex: wallet.publicKey,
      },
    ],
    authentication: [`${wallet.did}#key-1`],
    service: [{ id: `${wallet.did}#reputify`, type: "ReputifyCreditPassport", serviceEndpoint: "https://reputify.credit" }],
  };
}

export function didCommitment(wallet: Wallet): string {
  return commit(didDocument(wallet));
}

/** Sign an arbitrary message with the user's Ed25519 identity key. */
export function signWithWallet(wallet: Wallet, message: string): string {
  const sig = walletKey(wallet).sign(Buffer.from(message, "utf8"));
  return Buffer.from(sig).toString("hex");
}
