"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ngn } from "@/components/api";
import { ScoreDial } from "@/components/ScoreDial";
import { KycFlow } from "@/components/KycFlow";
import { PROVIDERS } from "@/lib/models";

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [consent, setConsent] = useState<any>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await api("/api/remi/me");
      setMe(d);
      const active = (d.consents ?? []).find((c: any) => c.audience === "bank:launch");
      if (active) setConsent(active);
    }
    catch { router.push("/login"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);

  async function genPassport() {
    setErr(""); setBusy("pp");
    try { await api("/api/remi/passport", {}); await refresh(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  }
  async function grant() {
    setErr(""); setBusy("consent");
    try { const d = await api("/api/remi/consent", { audience: "bank:launch" }); setConsent(d.consent); await refresh(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  }
  async function revoke() {
    if (!consent) return;
    setErr(""); setBusy("revoke");
    try { const d = await api("/api/remi/consent/revoke", { consentId: consent.consentId }); setConsent(d.consent); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  }
  async function logout() { await api("/api/remi/logout", {}); router.push("/"); }

  if (loading) return <main className="wrap" style={{ paddingTop: 60 }}><span className="spinner dark" /> Loading…</main>;
  if (!me) return null;

  const u = me.user;
  const kyc = u.kyc.status === "verified";
  const linked = u.linked.length > 0;
  const pp = me.passport;

  return (
    <main className="wrap" style={{ paddingTop: 36, paddingBottom: 70 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span className="eyebrow">Reputify dashboard</span>
          <h1 className="h-serif" style={{ fontSize: 36, margin: "8px 0 0", fontWeight: 600 }}>Hi, {u.name.split(" ")[0]}</h1>
        </div>
        <button className="btn ghost" onClick={logout}>Sign out</button>
      </div>

      {err && <div className="fraud" style={{ marginTop: 16 }}><span>⚠</span><div>{err}</div></div>}

      {/* Identity / wallet */}
      <div className="anchorbox" style={{ marginTop: 20 }}>
        <div className="tt">⛓ Your on-chain identity</div>
        <div className="kv" style={{ marginTop: 8 }}><span className="k">DID</span><span className="v">{u.wallet.did.slice(0, 42)}…</span></div>
        <div className="kv"><span className="k">Public key</span><span className="v">{u.wallet.publicKey.slice(0, 32) + "…"}</span></div>
        <div className="kv"><span className="k">DID anchored</span><span className="v">{u.didAnchorTxid ? `${u.didAnchorTxid.slice(0, 18)}…` : "—"}</span></div>
      </div>

      {/* Progress steps */}
      <div className="stack" style={{ marginTop: 20 }}>
        {/* KYC */}
        <StepCard n={1} title="Verify your identity (KYC)" done={kyc} active={!kyc}>
          {kyc ? (
            <div>
              <div className="clean" style={{ marginBottom: 10 }}><span>✓</span><div>Identity verified — Verifiable Credential anchored at <span className="mono">{u.kyc.anchorTxid?.slice(0, 16)}…</span></div></div>
              <ul className="reasons">
                {(u.kyc.checks ?? []).map((c: any, i: number) => (
                  <li key={i}><span className={`sign ${c.passed ? "pos" : "neg"}`}>{c.passed ? "✓" : "✕"}</span><span style={{ flex: 1 }}>{c.name}</span><span className="small muted">{c.detail}</span></li>
                ))}
              </ul>
            </div>
          ) : (
            <KycFlow defaultName={u.name} onDone={refresh} />
          )}
        </StepCard>

        {/* Link mobile money */}
        <StepCard n={2} title="Connect a mobile-money account" done={linked} active={kyc && !linked} locked={!kyc}>
          {u.linked.map((l: any) => (
            <div key={l.provider} className="clean" style={{ marginBottom: 8 }}><span>✓</span><div>Linked <b>{provName(l.provider)}</b> ({l.handle}) — Reputify reads {me.sources.find((s: any) => s.provider === l.provider)?.count ?? 0} transactions on consent.</div></div>
          ))}
          {kyc && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: u.linked.length ? 6 : 0 }}>
              {PROVIDERS.map((p) => (
                <Link key={p.id} href={`/wallet/${p.id}?connect=1`} className="btn ghost" style={{ borderColor: p.color, color: p.color }}>
                  {u.linked.some((l: any) => l.provider === p.id) ? "Re-connect" : "Connect"} {p.name} →
                </Link>
              ))}
            </div>
          )}
        </StepCard>

        {/* Passport */}
        <StepCard n={3} title="Generate your Credit Passport" done={!!pp} active={linked && !pp} locked={!linked}>
          {!pp ? (
            <button className="btn teal" onClick={genPassport} disabled={busy === "pp"}>{busy === "pp" ? <><span className="spinner" /> Scoring + anchoring…</> : "Build Passport → anchor on Hedera"}</button>
          ) : (
            <div className="grid2" style={{ alignItems: "start" }}>
              <div className="stack">
                <ScoreDial score={pp.score.score} band={pp.score.band} />
                {pp.aiRisk ? (
                  <div className="card pad" style={{ borderWidth: 1.5, borderColor: pp.aiRisk.riskLevel === "high" ? "var(--red)" : pp.aiRisk.riskLevel === "medium" ? "var(--amber)" : "var(--green)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div className="label">🛡️ AI risk analysis</div>
                      <span className="tag" title={pp.aiRisk.source === "openai" ? `Analyzed by ${pp.aiRisk.model}` : "Rule-based fallback (OpenAI unavailable)"}>
                        {pp.aiRisk.source === "openai" ? "AI" : "rules"} · {pp.aiRisk.riskLevel}
                      </span>
                    </div>
                    {pp.aiRisk.narrative && <p className="small" style={{ margin: "0 0 8px" }}>{pp.aiRisk.narrative}</p>}
                    <ul className="reasons">
                      {pp.aiRisk.flags.map((f: any, i: number) => (
                        <li key={i}><span className={`sign ${f.severity === "high" ? "neg" : f.severity === "info" ? "pos" : ""}`}>{f.severity === "info" ? "✓" : "!"}</span><span style={{ fontSize: 13 }}>{f.text}</span></li>
                      ))}
                    </ul>
                    {pp.features.fraud.circularLoopDetected && <div className="fraud" style={{ marginTop: 8 }}><span>⚠</span><div>{Math.round(pp.features.fraud.loopValueShare * 100)}% of inflow discounted as artificial income.</div></div>}
                  </div>
                ) : pp.features.fraud.circularLoopDetected ? (
                  <div className="fraud"><span>⚠</span><div><b>Artificial-income loop detected.</b> {Math.round(pp.features.fraud.loopValueShare * 100)}% of inflow discounted.</div></div>
                ) : (
                  <div className="clean"><span>✓</span><div>Fraud graph clean.</div></div>
                )}
                <div className="small muted">PD {(pp.score.pd * 100).toFixed(1)}% · monthly inflow {ngn(pp.features.monthlyInflow)} · commitment <span className="mono">{pp.commitment.slice(0, 14)}…</span></div>
                <button className="btn ghost" onClick={genPassport} disabled={busy === "pp"}>Re-score</button>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 10 }}>Why this score</div>
                <ul className="reasons">
                  {pp.score.reasons.map((r: any) => (
                    <li key={r.code}><span className={`sign ${r.direction === "positive" ? "pos" : "neg"}`}>{r.direction === "positive" ? "+" : "−"}</span><span>{r.label}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </StepCard>

        {/* Consent */}
        <StepCard n={4} title="Share with a bank" done={!!consent && !consent.revoked} active={!!pp} locked={!pp}>
          {!consent || consent.revoked ? (
            <div>
              {consent?.revoked && (
                <div className="fraud" style={{ marginBottom: 12 }}>
                  <span>⚠</span>
                  <div>Consent <span className="mono">{consent.consentId.slice(0, 18)}…</span> was revoked at {new Date(consent.revokedAt).toLocaleTimeString()} — the revocation is anchored, and the bank can no longer query this Passport under it.</div>
                </div>
              )}
              <button className="btn gold" onClick={grant} disabled={busy === "consent"}>{busy === "consent" ? <><span className="spinner" /> Signing + anchoring consent…</> : "Grant consent to launch bank"}</button>
            </div>
          ) : (
            <div>
              <div className="clean" style={{ marginBottom: 12 }}><span>✓</span><div>Consent signed with your key and anchored. Valid until {new Date(consent.expiresAt).toLocaleTimeString()}.</div></div>
              <div className="label">Hand this consent ID to the bank</div>
              <code style={{ display: "block", padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, margin: "8px 0", border: "1px solid var(--line)", wordBreak: "break-all" }}>{consent.consentId}</code>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(consent.consentId)}>Copy</button>
                <Link className="btn primary" href="/bank">Open bank console →</Link>
                <button className="btn ghost" style={{ borderColor: "var(--red)", color: "var(--red)" }} onClick={revoke} disabled={busy === "revoke"}>
                  {busy === "revoke" ? <><span className="spinner" /> Revoking…</> : "Revoke consent"}
                </button>
              </div>
            </div>
          )}
        </StepCard>
      </div>

      {/* On-chain ledger */}
      {me.ledger.length > 0 && (
        <div className="card pad" style={{ marginTop: 24 }}>
          <div className="label">Your on-chain ledger · {me.ledger.length} anchors</div>
          <div className="tw" style={{ marginTop: 10, border: "none" }}>
            <table className="feed">
              <thead><tr><th>Kind</th><th>Commitment</th><th>Transaction</th><th>Mode</th></tr></thead>
              <tbody>
                {me.ledger.map((a: any) => (
                  <tr key={a.txid}>
                    <td><span className="tag" style={{ textTransform: "uppercase" }}>{a.kind}</span></td>
                    <td className="mono" style={{ fontSize: 11 }}>{a.commitment.slice(0, 18)}…</td>
                    <td className="mono" style={{ fontSize: 11 }}>{a.broadcast ? <a className="txlink" href={a.explorerUrl} target="_blank" rel="noreferrer">{a.txid.slice(0, 16)}…</a> : `${a.txid.slice(0, 16)}…`}</td>
                    <td><span className="tag" style={{ color: a.broadcast ? "var(--teal)" : "var(--amber)" }}>{a.broadcast ? "live" : "sim"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

function provName(id: string) { return PROVIDERS.find((p) => p.id === id)?.name ?? id; }

function StepCard({ n, title, children, done, active, locked }: { n: number; title: string; children: React.ReactNode; done?: boolean; active?: boolean; locked?: boolean }) {
  return (
    <div className="card pad" style={{ opacity: locked ? 0.55 : 1, borderColor: active ? "var(--gold)" : "var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, background: done ? "var(--teal)" : active ? "var(--gold)" : "var(--surface-2)", color: done || active ? "#fff" : "var(--muted)" }}>{done ? "✓" : n}</span>
        <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
