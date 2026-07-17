"use client";
import { useEffect, useRef, useState } from "react";

interface Msg { role: "user" | "assistant"; content: string; }

const GREETING: Msg = {
  role: "assistant",
  content: "Hi! I'm the Reputify assistant. Ask me how to sign up, complete KYC, connect a wallet, build your Credit Passport, or how the bank console works.",
};

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setErr(""); setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assistant unavailable");
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        aria-label={open ? "Close help" : "Open help"}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", right: 20, bottom: 20, zIndex: 70, width: 56, height: 56, borderRadius: "50%",
          border: "none", cursor: "pointer", background: "var(--gold, #b07d1e)", color: "#fff", fontSize: 24,
          display: "grid", placeItems: "center", boxShadow: "0 6px 20px rgba(0,0,0,.20)",
        }}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div
          className="card"
          role="dialog"
          aria-label="Reputify help assistant"
          style={{
            position: "fixed", right: 20, bottom: 88, zIndex: 70, width: 360, maxWidth: "calc(100vw - 40px)",
            height: 480, maxHeight: "calc(100vh - 130px)", display: "flex", flexDirection: "column",
            overflow: "hidden", boxShadow: "0 14px 44px rgba(0,0,0,.24)",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--gold, #b07d1e)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>R</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Reputify Help</div>
              <div className="small muted" style={{ fontSize: 11 }}>AI assistant</div>
            </div>
          </div>

          <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%",
                  background: m.role === "user" ? "var(--gold, #b07d1e)" : "var(--surface-2, #f1f0ec)",
                  color: m.role === "user" ? "#fff" : "var(--ink, #1a1a1a)",
                  padding: "8px 11px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {busy && <div className="small muted" style={{ alignSelf: "flex-start" }}><span className="spinner dark" /> thinking…</div>}
            {err && <div className="fraud" style={{ fontSize: 13 }}><span>⚠</span><div>{err}</div></div>}
          </div>

          <div style={{ padding: 10, borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
            <input
              className="inp"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
              placeholder="Ask about Reputify…"
              style={{ flex: 1 }}
            />
            <button className="btn gold" onClick={send} disabled={busy || !input.trim()}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}
