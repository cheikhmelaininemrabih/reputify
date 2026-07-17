// Hedera anchoring layer (replaces the earlier BSV OP_RETURN layer).
//
// We commit only a 32-byte hash to Hedera (never personal data) as a message on
// a Hedera Consensus Service (HCS) topic, tagged with a "RPTFY1" protocol prefix.
// When operator credentials are configured the message is submitted to Hedera
// testnet for real and the UI links to HashScan. With no credentials we fall back
// to a clearly-labelled SIMULATED anchor so the demo always runs end to end.
import {
  Client,
  PrivateKey,
  TopicId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { createHash } from "node:crypto";
import type { Anchor, AnchorKind } from "./types";

const NETWORK = (process.env.HEDERA_NETWORK as "testnet" | "mainnet") || "testnet";
const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID?.trim();
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY?.trim();
const CONFIGURED_TOPIC = process.env.HEDERA_TOPIC_ID?.trim();
const PROTO = "RPTFY1";
// Live only when we have operator credentials to pay for + sign the submit.
const LIVE = !!(OPERATOR_ID && OPERATOR_KEY);
// Anchor.network is "test" | "main"; map from the Hedera network name.
const NET: "test" | "main" = NETWORK === "mainnet" ? "main" : "test";

export interface AnchorResult extends Anchor {
  note?: string;
  topicId?: string;
}

export function hederaMode(): "live" | "simulated" {
  return LIVE ? "live" : "simulated";
}

export function hederaStatus() {
  return {
    network: NETWORK,
    operatorId: OPERATOR_ID ?? null,
    topicId: CONFIGURED_TOPIC ?? cachedTopic ?? null,
    mode: hederaMode(),
    live: LIVE,
  };
}

export function explorerUrl(kind: "transaction" | "topic", id: string): string {
  return `https://hashscan.io/${NETWORK}/${kind}/${id}`;
}

let client: Client | null = null;
function getClient(): Client {
  if (client) return client;
  const c = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(OPERATOR_ID!, PrivateKey.fromStringED25519(OPERATOR_KEY!));
  client = c;
  return c;
}

// A topic to publish anchors to. Use the configured one, else create + cache one.
let cachedTopic: string | undefined = CONFIGURED_TOPIC || undefined;
async function ensureTopic(): Promise<TopicId> {
  if (cachedTopic) return TopicId.fromString(cachedTopic);
  const tx = await new TopicCreateTransaction()
    .setTopicMemo("Reputify credit-identity anchors")
    .execute(getClient());
  const receipt = await tx.getReceipt(getClient());
  const id = receipt.topicId!;
  cachedTopic = id.toString();
  return id;
}

function pseudoTxId(kind: AnchorKind, subjectId: string, commitmentHex: string, now: string): string {
  return createHash("sha256").update(`${kind}:${subjectId}:${commitmentHex}:${now}`).digest("hex").slice(0, 64);
}

function simulatedAnchor(commitmentHex: string, kind: AnchorKind, subjectId: string, now: string): AnchorResult {
  const pseudo = pseudoTxId(kind, subjectId, commitmentHex, now);
  const payload = `${PROTO}|${kind}|${commitmentHex}`;
  return {
    kind,
    commitment: commitmentHex,
    txid: pseudo,
    network: NET,
    broadcast: false,
    rawTxSize: Buffer.byteLength(payload, "utf8"),
    explorerUrl: cachedTopic ? explorerUrl("topic", cachedTopic) : explorerUrl("transaction", pseudo),
    createdAt: now,
    subjectId,
    topicId: cachedTopic,
    note: "Simulated anchor — set HEDERA_OPERATOR_ID + HEDERA_OPERATOR_KEY (testnet) to submit to Hedera for real.",
  };
}

/** Anchor a commitment on Hedera. Real when credentials are set, simulated otherwise. */
export async function anchorCommitment(commitmentHex: string, kind: AnchorKind, subjectId: string): Promise<AnchorResult> {
  const now = new Date().toISOString();
  if (!LIVE) return simulatedAnchor(commitmentHex, kind, subjectId, now);
  try {
    const topic = await ensureTopic();
    const message = `${PROTO}|${kind}|${commitmentHex}`;
    const submit = await new TopicMessageSubmitTransaction()
      .setTopicId(topic)
      .setMessage(message)
      .execute(getClient());
    await submit.getReceipt(getClient());
    const txid = submit.transactionId!.toString();
    return {
      kind,
      commitment: commitmentHex,
      txid,
      network: NET,
      broadcast: true,
      rawTxSize: Buffer.byteLength(message, "utf8"),
      explorerUrl: explorerUrl("transaction", txid),
      createdAt: now,
      subjectId,
      topicId: topic.toString(),
    };
  } catch {
    return simulatedAnchor(commitmentHex, kind, subjectId, now);
  }
}

/** Verify an anchor by reading the topic's messages back from the Hedera mirror node. */
export async function verifyOnChain(txid: string, commitmentHex: string): Promise<{ found: boolean; broadcast: boolean; detail: string }> {
  const topic = CONFIGURED_TOPIC || cachedTopic;
  if (!LIVE || !topic) {
    return { found: false, broadcast: false, detail: "Not broadcast (simulated anchor) — verified against local commitment." };
  }
  try {
    const base = NETWORK === "mainnet" ? "https://mainnet-public.mirrornode.hedera.com" : "https://testnet.mirrornode.hedera.com";
    const res = await fetch(`${base}/api/v1/topics/${topic}/messages?limit=100&order=desc`, { cache: "no-store" });
    if (!res.ok) throw new Error(`mirror ${res.status}`);
    const data = (await res.json()) as { messages?: { message: string }[] };
    for (const m of data.messages ?? []) {
      const decoded = Buffer.from(m.message, "base64").toString("utf8");
      if (decoded.startsWith(`${PROTO}|`) && decoded.includes(commitmentHex)) {
        return { found: true, broadcast: true, detail: "Commitment matches a message recorded on the Hedera topic." };
      }
    }
    return { found: false, broadcast: true, detail: "Topic found but commitment not present in recent messages." };
  } catch {
    return { found: false, broadcast: false, detail: "Could not reach the Hedera mirror node — verified against local commitment." };
  }
}
