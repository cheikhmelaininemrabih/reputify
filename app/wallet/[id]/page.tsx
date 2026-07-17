"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, ngn } from "@/components/api";
import { PROVIDERS } from "@/lib/models";
import { BILLERS } from "@/lib/billers";

const ACTIONS = [
  { id: "recharge", label: "Add money", icon: "⬇️" },
  { id: "send", label: "Send", icon: "📤" },
  { id: "bill", label: "Pay bill", icon: "🧾" },
  { id: "save", label: "Save", icon: "🐷" },
];
const RISK_COLOR: Record<string, string> = { healthy: "#2c7a57", elevated: "#9c6a12", high: "#a5382a" };

export default function Wallet() {
  const params = useParams(); const search = useSearchParams(); const router = useRouter();
  const id = String(params.id);
  const meta = PROVIDERS.find((p) => p.id === id);
  const connectIntent = search.get("connect") === "1";

  const [acct, setAcct] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [name, setName] = useState(""); const [phone, setPhone] = useState("+234"); const [password, setPassword] = useState("");
  const [action, setAction] = useState(""); const [amount, setAmount] = useState("");
  const [recipientId, setRecipientId] = useState(""); const [biller, setBiller] = useState("mtn");
  const [alert, setAlert] = useState<any>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await api("/api/provider/me");
      if (d.account.provider === id) { setAcct(d.account); const dir = await api("/api/provider/directory"); setRecipients(dir.recipients); }
      else setAcct(null);
    } catch { setAcct(null); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);

  if (!meta) return <main className="wrap" style={{ paddingTop: 60 }}>Unknown provider.</main>;
  const accent = meta.color;

  async function signup(e: React.FormEvent) { e.preventDefault(); setErr(""); setBusy("auth");
    try { const d = await api("/api/provider/signup", { provider: id, name, phone, password }); setAcct(d.account); refresh(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); } }
  async function login(e: React.FormEvent) { e.preventDefault(); setErr(""); setBusy("auth");
    try { const d = await api("/api/provider/login", { provider: id, phone, password }); setAcct(d.account); refresh(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); } }
  async function logout() { await api("/api/provider/logout", {}); setAcct(null); }

  function openAction(a: string) { setAction(a); setAmount(""); setErr(""); setAlert(null); }
  async function doTxn(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy("txn");
    try {
      const body: any = { action, amount: Number(amount) };
      if (action === "send") body.recipientId = recipientId;
      if (action === "bill") body.biller = biller;
      const d = await api("/api/provider/txn", body);
      setAcct(d.account); setAmount(""); setAction("");
      if (d.alert) setAlert(d.alert);
    } catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  }
  async function authorize() { setErr(""); setBusy("auth2");
    try {
      const g = await api("/api/provider/authorize", { audience: "remi" });
      await api("/api/remi/link/complete", { provider: g.grant.provider, providerAccountId: g.grant.providerAccountId, grantToken: g.grant.token, handle: g.grant.handle });
      router.push("/dashboard");
    } catch (e: any) { setErr(/(sign in|not signed)/i.test(e.message) ? "Create or sign in to your Reputify account first, then come back." : e.message); setBusy(""); }
  }

  return (
    <main className="wrap narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: accent + "22", color: accent, display: "grid", placeItems: "center", fontSize: 18 }}>📱</span>
        <div><div className="eyebrow" style={{ color: accent }}>{meta.name}</div><h1 className="h-serif" style={{ fontSize: 30, margin: 0, fontWeight: 600 }}>{meta.name} Wallet</h1></div>
      </div>

      {loading ? <div style={{ marginTop: 20 }}><span className="spinner dark" /></div> : !acct ? (
        <div className="card pad" style={{ marginTop: 18 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className={`btn ${mode === "signup" ? "gold" : "ghost"}`} onClick={() => setMode("signup")}>Sign up</button>
            <button className={`btn ${mode === "login" ? "gold" : "ghost"}`} onClick={() => setMode("login")}>Sign in</button>
          </div>
          <form onSubmit={mode === "signup" ? signup : login}>
            {mode === "signup" && <F label="Full name"><input className="inp" value={name} onChange={(e) => setName(e.target.value)} required /></F>}
            <F label="Phone"><input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} required /></F>
            <F label="Password"><input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></F>
            {mode === "signup" && <p className="small muted" style={{ marginTop: -2, marginBottom: 12 }}>Your account starts empty — add money and transact to build a real history.</p>}
            {err && <div className="fraud"><span>⚠</span><div>{err}</div></div>}
            <button className="btn gold" style={{ width: "100%", background: `linear-gradient(135deg,${accent},${accent}bb)` }} disabled={busy === "auth"}>{busy === "auth" ? <><span className="spinner" /> …</> : mode === "signup" ? `Open ${meta.name} account` : "Sign in"}</button>
          </form>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 18 }}>
          {alert && (
            <div className="fraud fade" style={{ borderWidth: 2, alignItems: "flex-start", padding: "16px 18px" }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <div><strong>AI fraud &amp; risk alert.</strong> {alert.text}<div style={{ marginTop: 8 }}><button className="btn ghost" onClick={() => setAlert(null)}>Dismiss</button></div></div>
            </div>
          )}
          {connectIntent && (
            <div className="anchorbox" style={{ borderColor: accent, background: accent + "18" }}>
              <div className="tt" style={{ color: accent }}>🔗 Reputify wants to read your transaction history</div>
              <p className="small" style={{ margin: "8px 0" }}>Scope: transactions:read, balance:read. You can revoke anytime.</p>
              {err && <div className="fraud" style={{ marginBottom: 8 }}><span>⚠</span><div>{err}</div></div>}
              <button className="btn gold" onClick={authorize} disabled={busy === "auth2"} style={{ background: `linear-gradient(135deg,${accent},${accent}bb)` }}>{busy === "auth2" ? <><span className="spinner" /> Authorizing…</> : "Authorize Reputify →"}</button>
            </div>
          )}

          {/* Balance */}
          <div className="card pad" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff", border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".1em", opacity: .85, textTransform: "uppercase" }}>{acct.name} · {acct.phone}</div><div className="h-serif" style={{ fontSize: 42, fontWeight: 600, marginTop: 4 }}>{ngn(acct.balance)}</div></div>
              <button className="btn ghost" onClick={logout} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)" }}>Sign out</button>
            </div>
          </div>

          {/* Actions + composer */}
          <div className="card pad">
            <div className="label" style={{ marginBottom: 12 }}>Move money</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ACTIONS.map((a) => (
                <button key={a.id} onClick={() => openAction(a.id)}
                  style={{ cursor: "pointer", padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${action === a.id ? accent : "var(--line-strong)"}`, background: action === a.id ? accent + "18" : "var(--surface)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
                  <span>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>

            {action && (
              <form onSubmit={doTxn} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {action === "send" && (
                  <label><div className="label" style={{ marginBottom: 6 }}>Send to</div>
                    <select className="inp" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} required>
                      <option value="">Choose a wallet…</option>
                      {recipients.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.provider.toUpperCase()} · {r.handle}</option>)}
                    </select>
                    {recipients.length === 0 && <div className="small muted" style={{ marginTop: 6 }}>No other wallets yet — open one on another provider to send between them.</div>}
                  </label>
                )}
                {action === "bill" && (
                  <label><div className="label" style={{ marginBottom: 6 }}>Biller</div>
                    <select className="inp" value={biller} onChange={(e) => setBiller(e.target.value)}>
                      <optgroup label="Airtime & data">{BILLERS.filter((b) => b.category === "airtime").map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}</optgroup>
                      <optgroup label="Utilities & TV">{BILLERS.filter((b) => b.category === "bill").map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}</optgroup>
                      <optgroup label="Betting">{BILLERS.filter((b) => b.category === "betting").map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}</optgroup>
                    </select>
                  </label>
                )}
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="label">₦</span>
                  <input className="inp" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="amount" autoFocus style={{ width: 150 }} />
                  {action === "recharge" && [5000, 20000, 50000].map((q) => <button key={q} type="button" className="btn ghost" onClick={() => setAmount(String(q))}>+{ngn(q)}</button>)}
                  <button className="btn primary" disabled={busy === "txn" || !amount}>{busy === "txn" ? "…" : "Confirm"}</button>
                  <button type="button" className="btn ghost" onClick={() => { setAction(""); setAmount(""); }}>Cancel</button>
                </div>
                {err && <div className="fraud"><span>⚠</span><div>{err}</div></div>}
              </form>
            )}
          </div>

          {acct.risk && <RiskPanel risk={acct.risk} />}

          <div className="card pad">
            <div className="label" style={{ marginBottom: 8 }}>Transactions · {acct.txCount}</div>
            <div className="tw" style={{ border: "none" }}>
              <table className="feed">
                <thead><tr><th>When</th><th>Type</th><th>To/From</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
                <tbody>{acct.recent.map((t: any) => (
                  <tr key={t.id}><td className="muted">{new Date(t.ts).toLocaleDateString()}</td><td><span className="tag" style={t.channel === "betting" ? { color: "var(--red)", background: "var(--red-soft)" } : {}}>{t.channel}</span></td><td className="mono" style={{ fontSize: 12 }}>{t.counterparty}</td><td className={`amt ${t.amount > 0 ? "in" : "out"}`}>{t.amount > 0 ? "+" : "−"}{ngn(t.amount)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function RiskPanel({ risk }: { risk: any }) {
  const color = RISK_COLOR[risk.riskLevel];
  return (
    <div className="card pad" style={{ borderColor: color, borderWidth: 1.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="label">🛡️ AI fraud &amp; risk monitor</div>
        <span className="band" style={{ color, background: color + "22", textTransform: "capitalize" }}>{risk.riskLevel} · {risk.riskScore}/100</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="label" style={{ marginBottom: 4 }}>Gambling exposure — {Math.round(risk.gamblingExposure * 100)}% of income</div>
        <div className="bar" style={{ height: 8 }}><i style={{ width: `${Math.min(100, risk.gamblingExposure * 100)}%`, background: risk.gamblingExposure >= 0.3 ? "var(--red)" : risk.gamblingExposure >= 0.12 ? "var(--amber)" : "var(--green)" }} /></div>
      </div>
      <ul className="reasons" style={{ marginTop: 14 }}>
        {risk.flags.map((f: any, i: number) => (
          <li key={i}><span className="sign" style={{ background: f.level === "high" ? "var(--red-soft)" : f.level === "warn" ? "#f0e2c4" : "#d7e9df", color: f.level === "high" ? "var(--red)" : f.level === "warn" ? "var(--amber)" : "var(--green)" }}>{f.level === "info" ? "✓" : "!"}</span><span style={{ fontSize: 14 }}>{f.text}</span></li>
        ))}
      </ul>
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "block", marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{label}</div>{children}</label>;
}
