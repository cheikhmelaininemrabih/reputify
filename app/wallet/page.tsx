"use client";
// Mobile-money wallet — its own app (added on user feedback: "the wallets
// need to be separated, a user needs to authorize from inside his wallet").
// Nothing to do with being a Reputify borrower: sign in as a wallet (provider
// + phone), see a real balance and ledger, add transactions by hand — that's
// what actually drives the cash-flow package once a connection is
// authorized (lib/wallets.ts packageFromWallet). Authorizing a pending
// Reputify connection request can ONLY happen here, never from the borrower
// app — same as approving a third-party app from inside your real bank.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ngn } from "@/components/api";
import { RepNav } from "@/components/RepNav";
import { getIdentity, setIdentity, clearIdentity, type Identity } from "@/components/identity";

const PROVIDERS = ["OPay", "Moniepoint", "PalmPay"] as const;
const CATEGORIES: { value: string; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "bill", label: "Bill payment" },
  { value: "transfer", label: "Transfer" },
  { value: "betting", label: "Betting" },
  { value: "other", label: "Other" },
];

function WalletApp() {
  const searchParams = useSearchParams();
  const authorizeId = searchParams.get("authorize");

  const [identity, setIdentityState] = useState<Identity | null | undefined>(undefined);
  const [wallets, setWallets] = useState<any[]>([]);
  const [pickId, setPickId] = useState("");
  const [form, setForm] = useState<{ provider: string; phone: string; name: string }>({ provider: "OPay", phone: "", name: "" });
  const [wallet, setWallet] = useState<any>(null);
  const [txnForm, setTxnForm] = useState({ amount: "", description: "", category: "income" });
  const [pendingConn, setPendingConn] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function loadIdentity() {
    const i = getIdentity();
    if (i?.role === "wallet") {
      const w = (await api("/api/rep/wallets")).wallets.find((x: any) => x.id === i.id);
      if (!w) { clearIdentity(); setIdentityState(null); setWallet(null); return; }
      setWallet(w);
      setIdentityState(i);
    } else {
      setIdentityState(i);
    }
  }
  async function loadWallets() {
    const r = await api("/api/rep/wallets");
    setWallets(r.wallets);
  }
  async function loadWallet(id: string) {
    const r = await api(`/api/rep/wallets/${id}`);
    setWallet(r.wallet);
  }
  async function loadPendingConn() {
    if (!authorizeId) { setPendingConn(null); return; }
    try {
      const r = await api(`/api/rep/connections/${authorizeId}`);
      setPendingConn(r.connection);
    } catch {
      setPendingConn(null);
    }
  }
  useEffect(() => { loadIdentity().catch((e) => setErr(e.message)); }, []);
  useEffect(() => { if (!identity) loadWallets().catch(() => {}); }, [identity]);
  useEffect(() => { if (identity?.role === "wallet") loadPendingConn().catch(() => {}); }, [identity, authorizeId]);
  // Live tracking: this wallet's balance/ledger, and whether the pending
  // authorization is still pending (in case it got denied elsewhere).
  useEffect(() => {
    if (identity?.role !== "wallet") return;
    const t = setInterval(() => { loadWallet(identity.id).catch(() => {}); loadPendingConn().catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, [identity, authorizeId]);

  function signInAs(id: string) {
    const w = wallets.find((x) => x.id === id);
    if (!w) return;
    setIdentity({ role: "wallet", id, name: `${w.name} (${w.provider})` });
    loadIdentity();
  }
  async function openWallet() {
    setBusy(true); setErr("");
    try {
      const r = await api("/api/rep/wallets", form);
      setIdentity({ role: "wallet", id: r.wallet.id, name: `${r.wallet.name} (${r.wallet.provider})` });
      setForm({ provider: "OPay", phone: "", name: "" });
      await loadIdentity();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function addTxn() {
    setBusy(true); setErr("");
    try {
      const amount = Number(txnForm.amount);
      await api(`/api/rep/wallets/${identity!.id}/transactions`, {
        amount, description: txnForm.description, category: txnForm.category,
      });
      setTxnForm({ amount: "", description: "", category: "income" });
      await loadWallet(identity!.id);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function authorize() {
    setBusy(true); setErr(""); setMsg("");
    try {
      await api(`/api/rep/wallets/${identity!.id}/authorize`, { connectionId: authorizeId });
      setMsg("Authorized — Reputify can now read this wallet's cash-flow history.");
      await loadPendingConn();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function deny() {
    setBusy(true); setErr("");
    try {
      await api(`/api/rep/connections/${authorizeId}`, { deny: true });
      await loadPendingConn();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main>
      <RepNav />
      <div style={wrap}>

        {identity === undefined && <p style={{ color: "var(--muted)" }}>Loading…</p>}

        {identity !== undefined && identity?.role !== "wallet" && (
          <>
            <header style={{ marginBottom: 18 }}>
              <p style={eyebrow}>Mobile-money wallet</p>
              <h1 style={{ margin: "2px 0", fontSize: 24, fontFamily: "var(--font-display)" }}>Sign in</h1>
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
                This is a separate app from Reputify — a mobile-money wallet (OPay, Moniepoint, PalmPay). Sign in here to authorize a connection request or manage the ledger.
              </p>
            </header>

            {wallets.length > 0 && (
              <section className="card pad" style={{ marginBottom: 18 }}>
                <h3 style={{ marginTop: 0 }}>Sign in as an existing wallet (demo)</h3>
                <div style={{ display: "flex", gap: 10 }}>
                  <select className="inp" value={pickId} onChange={(e) => setPickId(e.target.value)}>
                    <option value="">— select —</option>
                    {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.provider} · {w.phone}</option>)}
                  </select>
                  <button className="btn teal" disabled={busy || !pickId} onClick={() => signInAs(pickId)}>Sign in</button>
                </div>
              </section>
            )}

            <section className="card pad">
              <h3 style={{ marginTop: 0 }}>Open a wallet</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <select className="inp" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                  {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input className="inp" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="inp" placeholder="Phone (+234…)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <button className="btn gold" disabled={busy || !form.name || !form.phone} onClick={openWallet}>Open wallet &amp; sign in</button>
              </div>
            </section>
          </>
        )}

        {identity?.role === "wallet" && wallet && (
          <>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
              <div>
                <p style={eyebrow}>{wallet.provider} · {wallet.phone}</p>
                <h1 style={{ margin: "2px 0", fontSize: 24, fontFamily: "var(--font-display)" }}>{wallet.name}</h1>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Balance</p>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 700, fontFamily: "var(--font-display)" }}>{ngn(wallet.balance)}</p>
              </div>
            </header>

            {pendingConn && pendingConn.status === "pending" && (
              <section className="card pad" style={{ marginBottom: 18, border: "1px solid var(--gold)" }}>
                <p style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".02em" }}>Authorization requested</p>
                <h3 style={{ margin: "0 0 10px" }}><b>{pendingConn.borrowerName}</b>'s Reputify account wants to read this {pendingConn.provider} wallet</h3>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 10 }}>Requesting:</p>
                <ul style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 14, color: "var(--ink-2)" }}>
                  {pendingConn.scope.map((s: string) => <li key={s}>{s === "cashflow.read" ? "Read your cash-flow history" : s === "standing" ? "Maintain standing (revocable) access" : s}</li>)}
                </ul>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn gold" disabled={busy} onClick={authorize}>Allow</button>
                  <button className="btn ghost" disabled={busy} onClick={deny}>Deny</button>
                </div>
              </section>
            )}
            {pendingConn && pendingConn.status !== "pending" && msg && (
              <section className="card pad" style={{ marginBottom: 18 }}><p style={{ margin: 0, color: "var(--good)" }}>{msg}</p></section>
            )}

            <section className="card pad" style={{ marginBottom: 18 }}>
              <h3 style={{ marginTop: 0 }}>Add a transaction</h3>
              <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13.5 }}>Positive amount = money in, negative = money out. This is the real data your connected Reputify history is built from.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr auto", gap: 10, alignItems: "center" }}>
                <input className="inp" type="number" placeholder="Amount (± ₦)" value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })} />
                <input className="inp" placeholder={'Description (e.g. "Salary", "DSTV bill")'} value={txnForm.description} onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })} />
                <select className="inp" value={txnForm.category} onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <button className="btn gold" disabled={busy || !txnForm.amount || !txnForm.description} onClick={addTxn}>Add</button>
              </div>
            </section>

            <section className="card pad">
              <h3 style={{ marginTop: 0 }}>Ledger</h3>
              {wallet.txns.length === 0 && <p style={{ color: "var(--muted)", margin: 0 }}>No transactions yet.</p>}
              {[...wallet.txns].reverse().map((t: any) => (
                <div key={t.id} style={row}>
                  <span>{t.description} <span style={{ color: "var(--muted)" }}>· {CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category} · {t.at.slice(0, 10)}</span></span>
                  <span style={{ fontWeight: 600, color: t.amount > 0 ? "var(--good)" : "var(--bad)" }}>{t.amount > 0 ? "+" : ""}{ngn(t.amount)}</span>
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

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <WalletApp />
    </Suspense>
  );
}

const wrap: React.CSSProperties = { maxWidth: 700, margin: "0 auto", padding: "36px 20px" };
const eyebrow: React.CSSProperties = { color: "var(--muted)", fontWeight: 600, fontSize: 13, margin: 0 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--line)" };
