"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ngn } from "@/components/api";

const BAND_CLASS: Record<string, string> = { "Low risk": "low", "Medium risk": "med", "High risk": "high" };

export default function BankPortal() {
  const [bank, setBank] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [bankName, setBankName] = useState(""); const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState(""); const [busy, setBusy] = useState("");

  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { const d = await api("/api/bank/applicants"); setData(d); setBank(d.bank); }
    catch { setBank(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function auth(e: React.FormEvent) {
    e.preventDefault(); setAuthErr(""); setBusy("auth");
    try {
      mode === "signup" ? await api("/api/bank/signup", { bankName, username, password }) : await api("/api/bank/login", { username, password });
      await load();
    } catch (e: any) { setAuthErr(e.message); } finally { setBusy(""); }
  }
  async function logout() { await api("/api/bank/logout", {}); setBank(null); setData(null); }
  async function seed() { setBusy("seed"); try { await api("/api/bank/seed-demo", { count: 12 }); await load(); } finally { setBusy(""); } }
  async function decide(a: any, decision: "approved" | "declined") {
    setBusy(a.consentId);
    const amount = decision === "approved" ? Number(amounts[a.consentId] ?? a.suggestedAmount) : 0;
    try { await api("/api/bank/decision", { consentId: a.consentId, decision, amount }); await load(); } finally { setBusy(""); }
  }

  if (loading) return <main className="wrap" style={{ paddingTop: 60 }}><span className="spinner dark" /></main>;

  if (!bank) return (
    <main className="wrap narrow" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <span className="eyebrow" style={{ color: "#1e4d8c" }}>LenderHub · bank console</span>
      <h1 className="h-serif" style={{ fontSize: 36, margin: "8px 0 14px", fontWeight: 600 }}>Lender sign-in</h1>
      <div className="card pad">
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className={`btn ${mode === "login" ? "primary" : "ghost"}`} onClick={() => setMode("login")}>Sign in</button>
          <button className={`btn ${mode === "signup" ? "primary" : "ghost"}`} onClick={() => setMode("signup")}>Register bank</button>
        </div>
        <form onSubmit={auth}>
          {mode === "signup" && <F label="Bank name"><input className="inp" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="First Bank of Nigeria" required /></F>}
          <F label="Username"><input className="inp" value={username} onChange={(e) => setUsername(e.target.value)} required /></F>
          <F label="Password"><input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></F>
          {authErr && <div className="fraud"><span>⚠</span><div>{authErr}</div></div>}
          <button className="btn primary" style={{ width: "100%" }} disabled={busy === "auth"}>{busy === "auth" ? <><span className="spinner" /> …</> : mode === "signup" ? "Register" : "Sign in"}</button>
        </form>
      </div>
    </main>
  );

  const s = data?.summary ?? {};
  const applicants = (data?.applicants ?? []).filter((a: any) =>
    filter === "all" ? true : filter === "pending" ? !a.decision : filter === "flagged" ? (a.fraud || a.gamblingExposure >= 0.3) : a.band.toLowerCase().startsWith(filter));

  return (
    <main className="wrap" style={{ paddingTop: 36, paddingBottom: 70 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div><span className="eyebrow" style={{ color: "#1e4d8c" }}>LenderHub · {bank.bankName}</span><h1 className="h-serif" style={{ fontSize: 34, margin: "8px 0 0", fontWeight: 600 }}>Loan decisioning</h1></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={seed} disabled={busy === "seed"}>{busy === "seed" ? <><span className="spinner dark" /> Seeding…</> : "+ Seed demo applicants"}</button>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </div>
      </div>
      <p className="muted" style={{ maxWidth: "64ch" }}>Every applicant granted you consent. Reputify supplies the score and risk signals — <b>you</b> decide who gets a loan. Raw transaction data never leaves the borrower&apos;s vault.</p>

      {/* summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginTop: 8 }}>
        <Tile k="Applicants" v={s.applicants ?? 0} />
        <Tile k="Pending" v={s.pending ?? 0} />
        <Tile k="Approved" v={s.approved ?? 0} accent="#2c7a57" />
        <Tile k="Declined" v={s.declined ?? 0} accent="#a5382a" />
        <Tile k="Total lent" v={ngn(s.totalLent ?? 0)} />
        <Tile k="Avg score" v={s.avgScore ?? 0} />
      </div>

      {applicants.length === 0 && data?.applicants?.length === 0 && (
        <div className="card pad" style={{ marginTop: 20, textAlign: "center" }}>
          <p className="muted">No applicants yet. Click <b>Seed demo applicants</b> to populate your review pool, or have a borrower grant consent from their Reputify dashboard.</p>
        </div>
      )}

      {/* filters */}
      {data?.applicants?.length > 0 && (
        <div style={{ display: "flex", gap: 8, margin: "20px 0 12px", flexWrap: "wrap" }}>
          {[["all", "All"], ["pending", "Pending"], ["low", "Low risk"], ["medium", "Medium"], ["high", "High risk"], ["flagged", "⚠ Flagged"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`btn ${filter === k ? "primary" : "ghost"}`} style={{ padding: "7px 14px", fontSize: 13 }}>{l}</button>
          ))}
        </div>
      )}

      {/* applicant cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
        {applicants.map((a: any) => {
          const color = a.band === "Low risk" ? "#2c7a57" : a.band === "Medium risk" ? "#9c6a12" : "#a5382a";
          return (
            <div key={a.consentId} className="card pad" style={{ borderColor: a.decision ? "var(--line)" : color, borderWidth: a.decision ? 1 : 1.5, opacity: a.decision ? 0.85 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{a.name}</div>
                  <div className="mono small muted">{a.did.slice(0, 26)}…</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="h-serif" style={{ fontSize: 32, fontWeight: 600, color, lineHeight: 1 }}>{a.score}</div>
                  <span className={`band ${BAND_CLASS[a.band]}`} style={{ marginTop: 4 }}>{a.band}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 14, margin: "12px 0", flexWrap: "wrap", fontSize: 13 }}>
                <span className="muted">PD <b style={{ color: "var(--ink)" }}>{(a.pd * 100).toFixed(1)}%</b></span>
                <span className="muted">Income <b style={{ color: "var(--ink)" }}>{ngn(a.monthlyInflow)}/mo</b></span>
                {a.gamblingExposure >= 0.12 && <span style={{ color: a.gamblingExposure >= 0.3 ? "var(--red)" : "var(--amber)" }}>🎲 {Math.round(a.gamblingExposure * 100)}% gambling</span>}
                {a.fraud && <span style={{ color: "var(--red)" }}>⚠ fraud loop</span>}
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {a.reasons.slice(0, 3).map((r: any) => (
                  <span key={r.code} className="tag" style={{ color: r.direction === "positive" ? "var(--green)" : "var(--red)", background: r.direction === "positive" ? "#d7e9df" : "var(--red-soft)" }}>{r.direction === "positive" ? "+" : "−"} {r.label}</span>
                ))}
              </div>

              {a.decision ? (
                <div className={a.decision.decision === "approved" ? "clean" : "fraud"}><span>{a.decision.decision === "approved" ? "✓" : "✕"}</span><div>{a.decision.decision === "approved" ? `Approved · ${ngn(a.decision.amount)}` : "Declined"}</div></div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span className="label">₦</span>
                    <input className="inp" type="number" value={amounts[a.consentId] ?? a.suggestedAmount} onChange={(e) => setAmounts({ ...amounts, [a.consentId]: e.target.value })} style={{ padding: "8px 10px", fontSize: 14 }} />
                    <span className="small muted" style={{ whiteSpace: "nowrap" }}>suggested {ngn(a.suggestedAmount)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn teal" style={{ flex: 1 }} onClick={() => decide(a, "approved")} disabled={busy === a.consentId}>Approve</button>
                    <button className="btn ghost" style={{ flex: 1, borderColor: "var(--red)", color: "var(--red)" }} onClick={() => decide(a, "declined")} disabled={busy === a.consentId}>Decline</button>
                  </div>
                </div>
              )}
              {a.anchorTxid && <div className="small muted" style={{ marginTop: 10 }}>On-chain: <span className="mono">{a.anchorTxid.slice(0, 16)}…</span></div>}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Tile({ k, v, accent }: { k: string; v: any; accent?: string }) {
  return <div className="card pad" style={{ padding: "14px 16px" }}><div className="label">{k}</div><div className="h-serif" style={{ fontSize: 26, fontWeight: 600, color: accent, marginTop: 2 }}>{v}</div></div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "block", marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{label}</div>{children}</label>;
}
