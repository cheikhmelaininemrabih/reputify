"use client";
// Attester + governance ops (roadmap §9 "attester job — headless, optional ops
// dashboard"). Sign in as one attester, scoped to this browser tab (see
// components/identity.ts) — a borrower or lender tab open elsewhere keeps
// working simultaneously. Shows the attester marketplace (bond + real track
// record — an upheld dispute is a much stronger signal than bond size
// alone), the attestations posted, and the arbiter's dispute queue (uphold
// ⇒ slash) — shared governance views, not filtered to "your" attester
// specifically. Polls every few seconds so activity from other tabs (a new
// attestation minted, a dispute raised or ruled) shows up live.
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { RepNav } from "@/components/RepNav";
import { getIdentity, setIdentity, clearIdentity, type Identity } from "@/components/identity";

export default function AttesterOps() {
  const [identity, setIdentityState] = useState<Identity | null | undefined>(undefined);
  const [state, setState] = useState<any>(null);
  const [attesters, setAttesters] = useState<any[]>([]);
  const [pickAddr, setPickAddr] = useState("");
  const [name, setName] = useState("");
  const [stake, setStake] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function loadIdentity() {
    const i = getIdentity();
    if (i?.role === "attester") {
      const exists = (await api("/api/rep/attesters")).attesters.some((x: any) => x.address === i.id);
      if (!exists) {
        // Points at an attester that no longer exists (e.g. "Reset demo
        // data" wiped the store) — stale, clear so sign-in/register shows again.
        clearIdentity();
        setIdentityState(null);
        return;
      }
    }
    setIdentityState(i);
  }
  async function refresh() {
    const [s, a] = await Promise.all([api("/api/rep/state"), api("/api/rep/attesters")]);
    setState(s);
    setAttesters(a.attesters);
  }
  useEffect(() => { loadIdentity().catch((e) => setErr(e.message)); }, []);
  useEffect(() => { refresh().catch((e) => setErr(e.message)); }, []);
  // Live tracking: the marketplace + dispute queue are shared governance
  // views — keep them current with whatever other tabs are doing.
  useEffect(() => {
    const t = setInterval(() => { refresh().catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, []);

  async function run(fn: () => Promise<any>) {
    setBusy(true); setErr("");
    try { await fn(); await refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  function signInAs(address: string) {
    const a = attesters.find((x) => x.address === address);
    if (!a) return;
    setIdentity({ role: "attester", id: address, name: a.name });
    loadIdentity();
  }
  async function registerAndSignIn() {
    setBusy(true); setErr("");
    try {
      const r = await api("/api/rep/attesters", { name, stake });
      setIdentity({ role: "attester", id: r.attester.address, name: r.attester.name });
      setName("");
      await Promise.all([loadIdentity(), refresh()]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const open = (state?.challenges ?? []).filter((c: any) => !c.ruled);
  const ruled = (state?.challenges ?? []).filter((c: any) => c.ruled);

  return (
    <main>
      <RepNav />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 20px" }}>

        {identity === undefined && <p style={{ color: "var(--muted)" }}>Loading…</p>}

        {identity !== undefined && identity?.role !== "attester" && (
          <>
            <h1 style={{ margin: "0 0 18px", fontSize: 24, fontFamily: "var(--font-display)" }}>Attester ops — sign in</h1>
            {attesters.length > 0 && (
              <section className="card pad" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0 }}>Sign in as an existing attester (demo)</h3>
                <div style={{ display: "flex", gap: 10 }}>
                  <select className="inp" value={pickAddr} onChange={(e) => setPickAddr(e.target.value)}>
                    <option value="">— select —</option>
                    {attesters.map((a) => <option key={a.address} value={a.address}>{a.name}</option>)}
                  </select>
                  <button className="btn teal" disabled={busy || !pickAddr} onClick={() => signInAs(pickAddr)}>Sign in</button>
                </div>
              </section>
            )}
            <section className="card pad">
              <h3 style={{ marginTop: 0 }}>Register + accredit a new attester</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input className="inp" style={{ width: 200 }} placeholder="Attester name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="inp" style={{ width: 120 }} type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
                <button className="btn gold" disabled={busy || !name} onClick={registerAndSignIn}>Register &amp; sign in</button>
              </div>
            </section>
          </>
        )}

        {identity?.role === "attester" && (
          <>
            <h1 style={{ margin: "0 0 4px", fontSize: 24, fontFamily: "var(--font-display)" }}>Attester &amp; governance ops</h1>
            <p style={{ color: "var(--muted)", marginTop: 0 }}>
              Signed in as <b>{identity.name}</b> · {state?.attestations ?? 0} attestations posted · mode {state?.mode}
            </p>

            <section className="card pad" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Attester marketplace</h3>
              <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13.5 }}>Bond size alone doesn't tell a lender much — an upheld dispute against an attester does.</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={ath}>Attester</th><th style={ath}>Bond</th><th style={ath}>Attestations</th><th style={ath}>Disputes</th>
                  </tr>
                </thead>
                <tbody>
                  {attesters.map((a) => (
                    <tr key={a.address} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={atd}>{a.name} {a.accredited && <span style={{ color: "var(--teal)", fontSize: 12 }}>· accredited</span>}</td>
                      <td style={atd}><b>{a.bond}</b></td>
                      <td style={atd}>{a.stats.attestations}</td>
                      <td style={atd}>
                        {a.stats.disputesUpheld > 0
                          ? <span style={{ color: "var(--bad)" }}>{a.stats.disputesUpheld} upheld / {a.stats.disputesRaised}</span>
                          : a.stats.disputesRaised > 0
                            ? <span style={{ color: "var(--good)" }}>0 upheld / {a.stats.disputesRaised}</span>
                            : <span style={{ color: "var(--muted)" }}>none</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          </>
        )}

        {err && <p style={{ color: "var(--bad)", marginTop: 14 }}>{err}</p>}
      </div>
    </main>
  );
}

const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" };
const ath: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const atd: React.CSSProperties = { padding: "8px 8px" };
