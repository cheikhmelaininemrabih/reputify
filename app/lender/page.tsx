"use client";
// Lender dashboard (roadmap §9) — search → request → subscribe → verified view →
// decision → dispute. The Verified ✓ badge appears only when every received
// package's re-hash matched its on-chain attestation (the check runs server-side).
import { useEffect, useState } from "react";
import { api, ngn } from "@/components/api";
import { RepNav } from "@/components/RepNav";

export default function LenderDashboard() {
  const [lenderId, setLenderId] = useState("LenderHub");
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [sel, setSel] = useState("");
  const [view, setView] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [requested, setRequested] = useState(false);
  const [principal, setPrincipal] = useState(150000);
  const [disputeFor, setDisputeFor] = useState<number | null>(null);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function loadBorrowers() {
    const r = await api("/api/rep/borrowers");
    setBorrowers(r.borrowers);
    if (!sel && r.borrowers[0]) setSel(r.borrowers[0].id);
  }
  async function loadSub() {
    const r = await api(`/api/rep/lenders/subscribe?lenderId=${encodeURIComponent(lenderId)}`);
    setSub(r.subscription);
  }
  async function loadView(id: string) {
    if (!id) return;
    const [v, l, c] = await Promise.all([
      api(`/api/rep/lenders/borrowers/${id}?lenderId=${encodeURIComponent(lenderId)}`),
      api(`/api/rep/loans`),
      api(`/api/rep/disputes`),
    ]);
    setView(v);
    setLoans(l.loans.filter((x: any) => x.borrower === id));
    setChallenges(c.challenges);
    if (v.granularAllowed) setRequested(true);
  }
  useEffect(() => { loadBorrowers().catch((e) => setErr(e.message)); loadSub().catch(() => {}); }, []);
  useEffect(() => { loadSub().catch(() => {}); if (sel) loadView(sel).catch((e) => setErr(e.message)); }, [lenderId]);
  useEffect(() => { setRequested(false); if (sel) loadView(sel).catch((e) => setErr(e.message)); }, [sel]);

  async function run(fn: () => Promise<any>) {
    setBusy(true); setErr("");
    try { await fn(); await loadView(sel); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const rep = view?.reputation;
  const dueAt = new Date(Date.now() + 30 * 864e5).toISOString();
  const reliedOn = (view?.packages ?? []).map((p: any) => p.attestationSeq);
  const challengeFor = (loanId: number) => challenges.find((c) => c.loanId === loanId);

  return (
    <main>
      <RepNav />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontFamily: "var(--font-display)" }}>Lender dashboard</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input className="inp" style={{ width: 180 }} value={lenderId} onChange={(e) => setLenderId(e.target.value)} placeholder="Lender name" />
            {sub?.active ? (
              <span style={badge}>Subscribed ✓</span>
            ) : (
              <button className="btn gold" disabled={busy} onClick={() => run(async () => { await api("/api/rep/lenders/subscribe", { lenderId }); await loadSub(); })}>
                Subscribe
              </button>
            )}
          </div>
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
              {view.granularAllowed && view.subscribed && view.verified && <span style={badge}>Verified ✓</span>}
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

            {/* 2b — borrower approved, but no subscription yet: summary only */}
            {view.granularAllowed && !view.subscribed && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "var(--warn-bg)", border: "1px solid color-mix(in srgb,var(--warn) 30%,transparent)" }}>
                <p style={{ margin: "0 0 10px", color: "var(--warn)", fontWeight: 600 }}>
                  {rep.name} approved your request — subscribe to see the verified, granular data.
                </p>
                <button className="btn gold" disabled={busy} onClick={() => run(async () => { await api("/api/rep/lenders/subscribe", { lenderId }); await loadSub(); })}>
                  Subscribe to unlock
                </button>
              </div>
            )}

            {/* 3 — verified granular view */}
            {view.granularAllowed && view.subscribed && (
              <div style={{ marginTop: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                      <th style={th}>Period</th><th style={th}>Provider</th><th style={th}>Inflow</th><th style={th}>Volatility</th><th style={th}>Attester</th><th style={th}></th><th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.packages.map((p: any) => (
                      <tr key={p.attestationSeq} style={{ borderTop: "1px solid var(--line)" }}>
                        <td style={td}>{p.period}</td>
                        <td style={td}>{p.provider}</td>
                        <td style={td}>{ngn(p.monthlyInflow)}</td>
                        <td style={td}>{Math.round(p.volatility * 100)}%</td>
                        <td style={td}>{p.attesterName}</td>
                        <td style={td}>{p.verified ? <span style={{ color: "var(--good)" }}>✓</span> : <span style={{ color: "var(--bad)" }}>✗</span>}</td>
                        <td style={td}>{p.proof && <a href={p.proof.mirror} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>View on Hedera ↗</a>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {view.documents?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Uploaded documents</p>
                    {view.documents.map((d: any) => (
                      <div key={d.id} style={row}>
                        <span>{d.label} <span style={{ color: "var(--muted)" }}>· {d.kind.replace("_", " ")}</span></span>
                        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {d.verified ? <span style={{ color: "var(--good)" }}>✓ verified</span> : <span style={{ color: "var(--bad)" }}>✗ unverified</span>}
                          {d.proof && <a href={d.proof.mirror} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>View on Hedera ↗</a>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

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
            {loans.map((l) => {
              const ch = challengeFor(l.loanId);
              return (
                <div key={l.loanId} style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{ngn(l.principal)} · <b>{l.state}</b></span>
                    {l.state === "Active" && (
                      <span style={{ display: "flex", gap: 8 }}>
                        <button className="btn ghost" disabled={busy} onClick={() => run(() => api(`/api/rep/loans/${l.loanId}`, { action: "repaid", by: lenderId }))}>Mark repaid</button>
                        <button className="btn ghost" disabled={busy} onClick={() => run(() => api(`/api/rep/loans/${l.loanId}`, { action: "defaulted", by: lenderId }))}>Mark defaulted</button>
                      </span>
                    )}
                    {l.state === "Defaulted" && !ch && (
                      <button className="btn ghost" disabled={busy} onClick={() => setDisputeFor(disputeFor === l.loanId ? null : l.loanId)}>
                        Raise fraud dispute
                      </button>
                    )}
                    {ch && (
                      <span style={{ fontSize: 13, color: ch.ruled ? (ch.upheld ? "var(--bad)" : "var(--good)") : "var(--warn)" }}>
                        {ch.ruled ? (ch.upheld ? `Upheld — attester slashed ${ch.slashed}` : "Rejected — no slash") : "Dispute pending arbiter ruling"}
                      </span>
                    )}
                  </div>
                  {disputeFor === l.loanId && !ch && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input className="inp" style={{ flex: 1, minWidth: 200 }} placeholder="Evidence (e.g. ipfs://... or a short note)"
                        value={evidence} onChange={(e) => setEvidence(e.target.value)} />
                      <button className="btn gold" disabled={busy || !l.reliedOn?.length}
                        onClick={() => run(async () => {
                          await api("/api/rep/disputes", { loanId: l.loanId, attestationSeq: l.reliedOn[0], evidenceURI: evidence });
                          setDisputeFor(null); setEvidence("");
                        })}>
                        Submit dispute
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {err && <p style={{ color: "var(--bad)", marginTop: 14 }}>{err}</p>}
      </div>
    </main>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 6 };
const badge: React.CSSProperties = { background: "var(--good-bg)", color: "var(--good)", padding: "4px 12px", borderRadius: "var(--r-full)", fontWeight: 600, fontSize: 13 };
const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 8px" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" };
