"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/components/api";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await api("/api/remi/login", { phone, password }); router.push("/dashboard"); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <AuthShell
      brand="Reputify" dot="R"
      headline={<>Welcome back.</>}
      tagline="Sign in to check your Credit Passport, connect a wallet, or share your score with a lender."
      bullets={["Your identity lives in your Hedera wallet", "Every access is logged on-chain", "Revoke a bank's access anytime"]}
    >
      <span className="eyebrow">Welcome back</span>
      <h2>Sign in to Reputify</h2>
      <p className="sub">Use the phone and password from your account.</p>
      <form onSubmit={submit}>
        <label className="field"><span className="label">Phone number</span><input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 800 000 0000" required /></label>
        <label className="field"><span className="label">Password</span><input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required /></label>
        {err && <div className="fraud" style={{ marginBottom: 14 }}><span>⚠</span><div>{err}</div></div>}
        <button className="btn primary block lg" disabled={busy}>{busy ? <><span className="spinner" /> Signing in…</> : "Sign in"}</button>
      </form>
      <div className="auth-switch">New to Reputify? <Link href="/signup">Create an account</Link></div>
    </AuthShell>
  );
}
