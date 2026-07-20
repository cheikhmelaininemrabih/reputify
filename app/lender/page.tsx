"use client";
// Lender dashboard (roadmap §9) — four states: search → request → verified view →
// decision. The Verified ✓ badge appears only when every received package's
// re-hash matched its on-chain attestation (the check runs server-side).
import { useEffect, useState } from "react";
import { api, ngn } from "@/components/api";

export default function LenderDashboard() {
  const [lenderId, setLenderId] = useState("LenderHub");
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [sel, setSel] = useState("");
  const [view, setView] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [requested, setRequested] = useState(false);
  const [principal, setPrincipal] = useState(150000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function loadBorrowers() {
    const r = await api("/api/rep/borrowers");
    setBorrowers(r.borrowers);
    if (!sel && r.borrowers[0]) setSel(r.borrowers[0].id);
  }
  async function loadView(id: string) {
    if (!id) return;
    const [v, l] = await Promise.all([
      api(`/api/rep/lenders/borrowers/${id}?lenderId=${encodeURIComponent(lenderId)}`),
      api(`/api/rep/loans`),
    ]);
    setView(v);
    setLoans(l.loans.filter((x: any) => x.borrower === id));
    if (v.granularAllowed) setRequested(true);
  }
  useEffect(() => { loadBorrowers().catch((e) => setErr(e.message)); }, []);
  useEffect(() => { setRequested(false); if (sel) loadView(sel).catch((e) => setErr(e.message)); }, [sel]);

  async function run(fn: () => Promise<any>) {
    setBusy(true); setErr("");
    try { await fn(); await loadView(sel); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const rep = view?.reputation;
  const dueAt = new Date(Date.now() + 30 * 864e5).toISOString();
  const reliedOn = (view?.packages ?? []).map((p: any) => p.attestationSeq);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontFamily: "var(--font-display)" }}>Lender dashboard</h1>
        <input className="inp" style={{ width: 180 }} value={lenderId} onChange={(e) => setLenderId(e.target.value)} placeholder="Lender name" />
      </div>

      {/* 1 — search */}
      <section className="card pad" style={{ marginBottom: 16 }}>
        <label style={lbl}>Borrower</label>
        <select className="inp" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">— select —</option>
          {borrowers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </section>

      {rep && (
        <section className="card pad" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{rep.name}</h3>
            {view.granularAllowed && view.verified && <span style={badge}>Verified ✓</span>}
          </div>
          <p style={{ color: "var(--ink-2)", margin: "8px 0 0" }}>{rep.standing}</p>

          {/* 2 — request */}
          {!view.granularAllowed && (
            <div style={{ marginTop: 16 }}>
              {!requested ? (
                <button className="btn teal" disabled={busy}
                  onClick={() => run(async () => { await api("/api/rep/disclosures", { borrowerId: sel, lenderId }); setRequested(true); })}>
                  Request granular access
                </button>
              ) : (
                <p style={{ color: "var(--warn)", margin: 0 }}>Pending borrower approval…
                  <button className="btn ghost" style={{ marginLeft: 10 }} disabled={busy} onClick={() => run(async () => {})}>Refresh</button>
                </p>
              )}
            </div>
          )}

          {/* 3 — verified granular view */}
          {view.granularAllowed && (
            <div style={{ marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={th}>Period</th><th style={th}>Provider</th><th style={th}>Inflow</th><th style={th}>Volatility</th><th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {view.packages.map((p: any) => (
                    <tr key={p.attestationSeq} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={td}>{p.period}</td>
                      <td style={td}>{p.provider}</td>
                      <td style={td}>{ngn(p.monthlyInflow)}</td>
                      <td style={td}>{Math.round(p.volatility * 100)}%</td>
                      <td style={td}>{p.verified ? <span style={{ color: "var(--good)" }}>✓</span> : <span style={{ color: "var(--bad)" }}>✗</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 4 — decision */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
                <input className="inp" style={{ width: 160 }} type="number" value={principal} onChange={(e) => setPrincipal(Number(e.target.value))} />
                <button className="btn gold" disabled={busy}
                  onClick={() => run(() => api("/api/rep/loans", { lender: lenderId, borrower: sel, principal, dueAt, reliedOn }))}>
                  Issue loan
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {loans.length > 0 && (
        <section className="card pad">
          <h3 style={{ marginTop: 0 }}>Loans</h3>
          {loans.map((l) => (
            <div key={l.loanId} style={row}>
              <span>{ngn(l.principal)} · <b>{l.state}</b></span>
              {l.state === "Active" && (
                <span style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" disabled={busy} onClick={() => run(() => api(`/api/rep/loans/${l.loanId}`, { action: "repaid", by: lenderId }))}>Mark repaid</button>
                  <button className="btn ghost" disabled={busy} onClick={() => run(() => api(`/api/rep/loans/${l.loanId}`, { action: "defaulted", by: lenderId }))}>Mark defaulted</button>
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {err && <p style={{ color: "var(--bad)", marginTop: 14 }}>{err}</p>}
    </main>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 6 };
const badge: React.CSSProperties = { background: "var(--good-bg)", color: "var(--good)", padding: "4px 12px", borderRadius: "var(--r-full)", fontWeight: 600, fontSize: 13 };
const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 8px" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" };
