"use client";
// Borrower app (roadmap §9) — KYC gate, then four screens. The chain is
// invisible: no block, hash, timestamp, or HBAR anywhere. Everything is user
// actions + plain state.
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { RepNav } from "@/components/RepNav";
import { KycCapture } from "@/components/KycCapture";

type Tab = "providers" | "documents" | "standing" | "requests";
const PROVIDERS = ["OPay", "Moniepoint", "PalmPay"] as const;
const DOC_KINDS: { value: string; label: string }[] = [
  { value: "ownership", label: "Proof of asset ownership" },
  { value: "utility_water", label: "Water bill" },
  { value: "utility_electricity", label: "Electricity bill" },
  { value: "utility_gas", label: "Gas bill" },
  { value: "other", label: "Other" },
];

export default function BorrowerApp() {
  const [borrowerId, setBorrowerId] = useState<string>("");
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("providers");
  const [connections, setConnections] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [rep, setRep] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", personhoodId: "" });
  const [pendingConn, setPendingConn] = useState<any>(null); // consent-modal target
  const [docForm, setDocForm] = useState({ kind: "ownership", label: "" });
  const [docFile, setDocFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function loadBorrowers() {
    const r = await api("/api/rep/borrowers");
    setBorrowers(r.borrowers);
    const saved = localStorage.getItem("rep_borrower");
    if (saved && r.borrowers.some((b: any) => b.id === saved)) setBorrowerId(saved);
    else if (r.borrowers[0]) setBorrowerId(r.borrowers[0].id);
  }
  async function loadAll(id: string) {
    if (!id) return;
    const [c, rr, d] = await Promise.all([
      api(`/api/rep/borrowers/${id}/connections`),
      api(`/api/rep/borrowers/${id}/reputation`).catch(() => ({ reputation: null, requests: [] })),
      api(`/api/rep/borrowers/${id}/documents`),
    ]);
    setConnections(c.connections);
    setRep(rr.reputation);
    setRequests(rr.requests);
    setDocuments(d.documents);
  }
  useEffect(() => { loadBorrowers().catch((e) => setErr(e.message)); }, []);
  useEffect(() => { if (borrowerId) { localStorage.setItem("rep_borrower", borrowerId); loadAll(borrowerId).catch((e) => setErr(e.message)); } }, [borrowerId]);

  async function run(fn: () => Promise<any>) {
    setBusy(true); setErr("");
    try { await fn(); await loadAll(borrowerId); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function onboard() {
    setBusy(true); setErr("");
    try {
      const r = await api("/api/rep/borrowers", form);
      await loadBorrowers();
      setBorrowerId(r.borrower.id);
      setForm({ name: "", phone: "", personhoodId: "" });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function requestConnect(provider: string) {
    setBusy(true); setErr("");
    try {
      const r = await api(`/api/rep/borrowers/${borrowerId}/connections`, { provider });
      setPendingConn({ id: r.connection.id, provider: r.connection.provider, scope: r.connection.scope });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function decideConn(approve: boolean) {
    if (!pendingConn) return;
    await run(() => api(`/api/rep/borrowers/${borrowerId}/connections`, { decide: pendingConn.id, approve }));
    setPendingConn(null);
  }
  function onDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocFile(reader.result as string);
    reader.readAsDataURL(file);
    if (!docForm.label) setDocForm({ ...docForm, label: file.name });
  }
  async function uploadDoc() {
    if (!docFile) return;
    const [meta, base64] = docFile.split(",");
    const mime = meta.match(/data:(.*);base64/)?.[1] ?? "application/octet-stream";
    await run(() => api(`/api/rep/borrowers/${borrowerId}/documents`, { kind: docForm.kind, label: docForm.label, fileBase64: base64, mime }));
    setDocFile(null); setDocForm({ kind: "ownership", label: "" });
  }

  const active = borrowers.find((b) => b.id === borrowerId);
  const kycVerified = active?.kyc?.status === "verified";

  return (
    <main>
      <RepNav />
      <div style={wrap}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <p style={eyebrow}>Your account</p>
          <h1 style={{ margin: "2px 0", fontSize: 24, fontFamily: "var(--font-display)" }}>{active ? active.name : "Borrower"}</h1>
        </div>
        {borrowers.length > 0 && (
          <select className="inp" style={{ width: "auto" }} value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)}>
            {borrowers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </header>

      {!active && (
        <section className="card pad" style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>Create your account</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <input className="inp" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="inp" placeholder="Phone (+234…)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="inp" placeholder="National ID (NIN/BVN)" value={form.personhoodId} onChange={(e) => setForm({ ...form, personhoodId: e.target.value })} />
            <button className="btn gold" disabled={busy} onClick={onboard}>Create account</button>
          </div>
        </section>
      )}

      {active && !kycVerified && (
        <KycCapture borrowerId={borrowerId} onDone={() => loadBorrowers()} />
      )}

      {active && kycVerified && (
        <>
          <nav style={tabs}>
            {(["providers", "documents", "standing", "requests"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className="btn" style={tab === t ? tabOn : tabOff}>
                {t === "providers" ? "Connected providers" : t === "documents" ? "Documents" : t === "standing" ? "Your standing" : `Requests${requests.length ? ` (${requests.length})` : ""}`}
              </button>
            ))}
          </nav>

          {tab === "providers" && (
            <section className="card pad">
              <p style={{ marginTop: 0, color: "var(--muted)" }}>Connect the mobile-money apps you use. Each connection needs your explicit approval, just like the real app's consent screen — and you can revoke any time.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                {PROVIDERS.map((p) => {
                  const approved = connections.find((c) => c.provider === p && c.status === "approved" && !c.revoked);
                  const pending = connections.find((c) => c.provider === p && c.status === "pending");
                  return (
                    <button key={p} className={approved ? "btn ghost" : "btn teal"} disabled={busy || !!approved || !!pending}
                      onClick={() => requestConnect(p)}>
                      {approved ? `${p} · connected` : pending ? `${p} · awaiting your approval` : `Connect ${p}`}
                    </button>
                  );
                })}
              </div>
              {connections.filter((c) => c.status === "approved" && !c.revoked).map((c) => (
                <div key={c.id} style={row}>
                  <span>{c.provider}</span>
                  <button className="btn ghost" disabled={busy}
                    onClick={() => run(() => api(`/api/rep/borrowers/${borrowerId}/connections`, { revoke: c.id }))}>Revoke</button>
                </div>
              ))}
              <button className="btn gold block" style={{ marginTop: 16 }} disabled={busy}
                onClick={() => run(() => api(`/api/rep/borrowers/${borrowerId}/mint`, { months: 6 }))}>
                Update my history from connected providers
              </button>
            </section>
          )}

          {tab === "documents" && (
            <section className="card pad">
              <p style={{ marginTop: 0, color: "var(--muted)" }}>Upload proof of owned assets or utility bills. Files stay encrypted off-chain — only a hash is ever anchored on Hedera, so anyone you share access with can confirm it wasn't tampered with, without the file itself ever being public.</p>
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                <select className="inp" value={docForm.kind} onChange={(e) => setDocForm({ ...docForm, kind: e.target.value })}>
                  {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <input className="inp" placeholder={'Label (e.g. "Land title — Plot 12")'} value={docForm.label} onChange={(e) => setDocForm({ ...docForm, label: e.target.value })} />
                <input type="file" onChange={onDocFile} />
                <button className="btn gold" disabled={busy || !docFile || !docForm.label} onClick={uploadDoc}>Upload &amp; anchor</button>
              </div>
              {documents.length === 0 && <p style={{ color: "var(--muted)", margin: 0 }}>No documents uploaded yet.</p>}
              {documents.map((d) => (
                <div key={d.id} style={row}>
                  <span>{d.label} <span style={{ color: "var(--muted)" }}>· {DOC_KINDS.find((k) => k.value === d.kind)?.label ?? d.kind}</span></span>
                  <span style={{ fontSize: 12.5, color: d.broadcast ? "var(--good)" : "var(--muted)" }}>
                    {d.broadcast && d.proof ? <a href={d.proof.mirror} target="_blank" rel="noreferrer">On Hedera ↗</a> : d.broadcast ? "anchored" : "simulated anchor"}
                  </span>
                </div>
              ))}
            </section>
          )}

          {tab === "standing" && rep && (
            <section className="card pad">
              <p style={{ marginTop: 0, color: "var(--muted)" }}>This is what a lender sees at a glance — no raw data.</p>
              <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5 }}>{rep.standing}</p>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 10 }}>
                <Stat label="Months of history" value={rep.monthsOfHistory} />
                <Stat label="Providers" value={rep.providersConnected} />
                <Stat label="Loans repaid" value={rep.loansRepaid} />
                <Stat label="Defaults" value={rep.loansDefaulted} />
              </div>
            </section>
          )}

          {tab === "requests" && (
            <section className="card pad">
              {requests.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>No pending requests.</p>}
              {requests.map((r) => (
                <div key={r.id} style={{ ...row, alignItems: "flex-start", flexDirection: "column", gap: 10 }}>
                  <span><b>{r.lenderId}</b> wants to see your cash-flow history and documents</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn gold" disabled={busy} onClick={() => run(() => api(`/api/rep/disclosures/${r.id}`, { allow: true }))}>Allow</button>
                    <button className="btn ghost" disabled={busy} onClick={() => run(() => api(`/api/rep/disclosures/${r.id}`, { allow: false }))}>Deny</button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {err && <p style={{ color: "var(--bad)", marginTop: 14 }}>{err}</p>}
      </div>

      {pendingConn && (
        <div style={overlay}>
          <div className="card pad" style={{ maxWidth: 380, width: "90%" }}>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600, letterSpacing: ".02em" }}>{pendingConn.provider} · requesting access</p>
            <h3 style={{ margin: "0 0 12px" }}>Allow Reputify to connect to your {pendingConn.provider} account?</h3>
            <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 10 }}>This app is requesting:</p>
            <ul style={{ margin: "0 0 18px", paddingLeft: 20, fontSize: 14, color: "var(--ink-2)" }}>
              {pendingConn.scope.map((s: string) => <li key={s}>{s === "cashflow.read" ? "Read your cash-flow history" : s === "standing" ? "Maintain standing (revocable) access" : s}</li>)}
            </ul>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn gold" style={{ flex: 1 }} disabled={busy} onClick={() => decideConn(true)}>Allow</button>
              <button className="btn ghost" style={{ flex: 1 }} disabled={busy} onClick={() => decideConn(false)}>Deny</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-display)" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 620, margin: "0 auto", padding: "36px 20px" };
const eyebrow: React.CSSProperties = { color: "var(--muted)", fontWeight: 600, fontSize: 13, margin: 0 };
const tabs: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" };
const tabOn: React.CSSProperties = { background: "var(--ink)", color: "var(--bg)", fontSize: 13.5, padding: "9px 14px" };
const tabOff: React.CSSProperties = { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)", fontSize: 13.5, padding: "9px 14px" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--line)" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 };
