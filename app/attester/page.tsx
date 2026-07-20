"use client";
// Attester + governance ops (roadmap §9 "attester job — headless, optional ops
// dashboard"). Shows bond status, the attestations posted, and the arbiter's
// dispute queue (uphold ⇒ slash).
import { useEffect, useState } from "react";
import { api } from "@/components/api";

export default function AttesterOps() {
  const [state, setState] = useState<any>(null);
  const [name, setName] = useState("");
  const [stake, setStake] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() { setState(await api("/api/rep/state")); }
  useEffect(() => { refresh().catch((e) => setErr(e.message)); }, []);

  async function run(fn: () => Promise<any>) {
    setBusy(true); setErr("");
    try { await fn(); await refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const open = (state?.challenges ?? []).filter((c: any) => !c.ruled);
  const ruled = (state?.challenges ?? []).filter((c: any) => c.ruled);

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "36px 20px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 24, fontFamily: "var(--font-display)" }}>Attester &amp; governance ops</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>{state?.attestations ?? 0} attestations posted · mode {state?.mode}</p>

      <section className="card pad" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Attesters</h3>
        {(state?.attesters ?? []).map((a: any) => (
          <div key={a.address} style={row}>
            <span>{a.name} · bond <b>{a.bond}</b> {a.accredited ? "· accredited" : ""}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <input className="inp" style={{ width: 200 }} placeholder="Attester name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="inp" style={{ width: 120 }} type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
          <button className="btn teal" disabled={busy || !name} onClick={() => run(async () => { await api("/api/rep/attesters", { name, stake }); setName(""); })}>
            Register + accredit
          </button>
        </div>
      </section>

      <section className="card pad" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Dispute queue (arbiter)</h3>
        {open.length === 0 && <p style={{ color: "var(--muted)", margin: 0 }}>No open challenges.</p>}
        {open.map((c: any) => (
          <div key={c.challengeId} style={{ ...row, flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <span>Challenge #{c.challengeId} · loan {c.loanId} · attestation seq {c.attestationSeq}</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn gold" disabled={busy} onClick={() => run(() => api(`/api/rep/disputes/${c.challengeId}`, { upheld: true }))}>Uphold (slash)</button>
              <button className="btn ghost" disabled={busy} onClick={() => run(() => api(`/api/rep/disputes/${c.challengeId}`, { upheld: false }))}>Reject</button>
            </div>
          </div>
        ))}
        {ruled.map((c: any) => (
          <div key={c.challengeId} style={row}>
            <span>Challenge #{c.challengeId} · <b style={{ color: c.upheld ? "var(--bad)" : "var(--good)" }}>{c.upheld ? `UPHELD — slashed ${c.slashed}` : "rejected — no slash"}</b></span>
          </div>
        ))}
      </section>

      <section className="card pad">
        <h3 style={{ marginTop: 0 }}>Recent activity</h3>
        {(state?.audit ?? []).slice(0, 14).map((a: any, i: number) => (
          <div key={i} style={{ fontSize: 13.5, color: "var(--ink-2)", padding: "4px 0" }}>
            <span style={{ color: "var(--muted)" }}>{a.actor}</span> — {a.action}
          </div>
        ))}
      </section>

      {err && <p style={{ color: "var(--bad)", marginTop: 14 }}>{err}</p>}
    </main>
  );
}

const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" };
