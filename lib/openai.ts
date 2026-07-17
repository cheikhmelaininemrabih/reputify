// Minimal server-side OpenAI client (Chat Completions via fetch — no SDK dependency).
// Reads OPENAI_API_KEY from the environment (.env.local). Shared by the help
// chatbot and the LLM fraud analyst. Never call this from client components.
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function hasOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

export interface ChatOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean; // ask for a JSON object response
  timeoutMs?: number;
}

/** One-shot chat completion. Throws on non-2xx or timeout. */
export async function chat(messages: ChatMessage[], opts: ChatOpts = {}): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.model || "gpt-4o-mini",
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 600,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(t);
  }
}
