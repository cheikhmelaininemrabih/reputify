// Live HCS submit path (roadmap §2/§4). Only imported when Hedera operator
// credentials are configured. Kept separate so the simulated default never loads
// the SDK's network client. Returns the real topic sequence number — the id
// that LoanRegistry.reliedOn points to.
import {
  Client, PrivateKey, TopicId, TopicCreateTransaction, TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";

const NETWORK = (process.env.HEDERA_NETWORK as "testnet" | "mainnet") || "testnet";
const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID!.trim();
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY!.trim();
let CONFIGURED_TOPIC = process.env.HEDERA_ATTEST_TOPIC_ID?.trim();

let client: Client | null = null;
function getClient(): Client {
  if (client) return client;
  const c = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(OPERATOR_ID, PrivateKey.fromStringED25519(OPERATOR_KEY));
  client = c;
  return c;
}

async function ensureTopic(): Promise<TopicId> {
  if (CONFIGURED_TOPIC) return TopicId.fromString(CONFIGURED_TOPIC);
  const tx = await new TopicCreateTransaction().setTopicMemo("Reputify attestation log").execute(getClient());
  const receipt = await tx.getReceipt(getClient());
  CONFIGURED_TOPIC = receipt.topicId!.toString();
  console.log(`[hedera] created attestation topic ${CONFIGURED_TOPIC} — set HEDERA_ATTEST_TOPIC_ID to pin it across restarts`);
  return receipt.topicId!;
}

export async function submitToTopic(message: string): Promise<{ sequenceNumber: number; consensusTimestamp: string }> {
  const topic = await ensureTopic();
  const submit = await new TopicMessageSubmitTransaction().setTopicId(topic).setMessage(message).execute(getClient());
  const receipt = await submit.getReceipt(getClient());
  return {
    sequenceNumber: receipt.topicSequenceNumber!.toNumber(),
    consensusTimestamp: new Date().toISOString(),
  };
}
