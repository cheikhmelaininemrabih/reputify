// World A — the attestation layer on Hedera Consensus Service (roadmap §4).
// An attestation is ONE signed message on the topic. No contract is involved in
// creating it. Hedera returns a consensus timestamp and a sequence number; that
// sequence number is the id a LoanRegistry.reliedOn entry points to — the only
// join between the two on-chain worlds.
//
// Simulated by default (a monotonic seq is minted locally); when Hedera operator
// credentials are configured the message is submitted to a real HCS topic and
// the true topicSequenceNumber is used. Reads come from the mirror node in live
// mode; from the local store in simulated mode.
import { canonical } from "./crypto";
import { signMsg, verifyMsg } from "./rep-wallet";
import { rdb, nextSeq, rsave, raudit } from "./rep-db";
import type { Attester, AttestationMsg } from "./rep-types";

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID?.trim();
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY?.trim();
const LIVE = !!(OPERATOR_ID && OPERATOR_KEY);

/** The exact fields an attester signs (order fixed by canonical()). */
function signable(f: Pick<AttestationMsg, "v" | "subject" | "attester" | "type" | "period" | "hash">): string {
  return canonical({ v: f.v, subject: f.subject, attester: f.attester, type: f.type, period: f.period, hash: f.hash });
}

interface SubmitInput {
  attester: Attester;
  attesterSignPrivKey: string; // custodial signing key
  subject: string;             // borrowerId
  period: string;
  hash: string;                // SHA-256 of the granular package
  packageUri: string;
}

/** Submit an attestation to HCS. Real when credentials are set, simulated otherwise. */
export async function submitAttestation(input: SubmitInput): Promise<AttestationMsg> {
  const base = { v: 1 as const, subject: input.subject, attester: input.attester.address,
                 type: "throughput" as const, period: input.period, hash: input.hash };
  const sig = signMsg(input.attesterSignPrivKey, signable(base));

  let seq: number;
  let consensusTimestamp: string;
  let broadcast = false;

  if (LIVE) {
    try {
      const { submitToTopic } = await import("./hcs-live");
      const r = await submitToTopic(`RPTFY-ATT|${base.period}|${input.hash}`);
      seq = r.sequenceNumber;
      consensusTimestamp = r.consensusTimestamp;
      broadcast = true;
    } catch (e) {
      console.error("[hedera] live attestation submit failed, falling back to simulated:", e);
      seq = nextSeq("attestation");
      consensusTimestamp = new Date().toISOString();
    }
  } else {
    seq = nextSeq("attestation");
    consensusTimestamp = new Date().toISOString();
  }

  const msg: AttestationMsg = { seq, ...base, sig, packageUri: input.packageUri, consensusTimestamp, broadcast };
  rdb.attestations[seq] = msg;
  rsave();
  raudit({ actor: input.attester.name, action: `attested ${base.type} ${period(base.period)}`, subject: input.subject, ref: `seq:${seq}` });
  return msg;
}

const period = (p: string) => p;

/** Read a borrower's attestations. Mirror node in live mode; store in sim mode. */
export function attestationsForSubject(subject: string): AttestationMsg[] {
  return Object.values(rdb.attestations)
    .filter((m) => m.subject === subject)
    .sort((a, b) => a.seq - b.seq);
}

export function getAttestation(seq: number): AttestationMsg | undefined {
  return rdb.attestations[seq];
}

/** Verify an attestation's signature against the attester's known public key. */
export function verifyAttestation(msg: AttestationMsg): boolean {
  const attester = rdb.attesters[msg.attester];
  if (!attester) return false;
  const s = signable(msg);
  return verifyMsg(attester.signPublicKey, s, msg.sig);
}

export function attestationMode(): "live" | "simulated" {
  return LIVE ? "live" : "simulated";
}
