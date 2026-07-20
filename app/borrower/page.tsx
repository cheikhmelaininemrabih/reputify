"use client";
// Borrower app (roadmap §9) — three screens. The chain is invisible: no block,
// hash, timestamp, or HBAR anywhere. Everything is user actions + plain state.
import { useEffect, useState } from "react";
import { api } from "@/components/api";

type Tab = "providers" | "standing" | "requests";
const PROVIDERS = ["OPay", "Moniepoint", "PalmPay"] as const;

export default function BorrowerApp() {
  const [borrowerId, setBorrowerId] = useState<string>("");
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("providers");
  const [connections, setConnections] = useState<any[]>([]);
  const [rep, setRep] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", personhoodId: "" });
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
    const [c, rr] = await Promise.all([
      api(`/api/rep/borrowers/${id}/connections`),
      api(`/api/rep/borrowers/${id}/reputation`),
    ]);
    setConnections(c.connections);
    setRep(rr.reputation);
    setRequests(rr.requests);
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

  const active = borrowers.find((b) => b.id === borrowerId);

  return (
    <main style={wrap}>
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

      {active && (
        <>
          <nav style={tabs}>
            {(["providers", "standing", "requests"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className="btn" style={tab === t ? tabOn : tabOff}>
                {t === "providers" ? "Connected providers" : t === "standing" ? "Your standing" : `Requests${requests.length ? ` (${requests.length})` : ""}`}
              </button>
            ))}
          </nav>

          {tab === "providers" && (
            <section className="card pad">
              <p style={{ marginTop: 0, color: "var(--muted)" }}>Connect the mobile-money apps you use. You can revoke any time — nothing is read without your consent.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                {PROVIDERS.map((p) => {
                  const linked = connections.find((c) => c.provider === p && !c.revoked);
                  return (
                    <button key={p} className={linked ? "btn ghost" : "btn teal"} disabled={busy || !!linked}
                      onClick={() => run(() => api(`/api/rep/borrowers/${borrowerId}/connections`, { provider: p }))}>
                      {linked ? `${p} · connected` : `Connect ${p}`}
                    </button>
                  );
                })}
              </div>
              {connections.filter((c) => !c.revoked).map((c) => (
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
                  <span><b>{r.lenderId}</b> wants to see your cash-flow history</span>
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
