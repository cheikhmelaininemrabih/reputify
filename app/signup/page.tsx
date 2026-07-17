"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/components/api";
import { AuthShell } from "@/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+234");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await api("/api/remi/signup", { name, phone, password }); router.push("/dashboard"); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <AuthShell
      brand="Reputify" dot="R"
      headline={<>Your credit, <span style={{ opacity: .8 }}>everywhere you go.</span></>}
      tagline="Turn the money you already move into a portable credit identity that banks trust — owned by you, anchored on Hedera."
      bullets={["A Hedera wallet & DID minted the moment you join", "One-time KYC, reusable everywhere", "You decide who sees your score"]}
    >
      <span className="eyebrow">Get started</span>
      <h2>Create your account</h2>
      <p className="sub">It takes about a minute. No documents needed to start.</p>
      <form onSubmit={submit}>
        <label className="field"><span className="label">Full name</span><input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amara Okafor" required /></label>
        <label className="field"><span className="label">Phone number</span><input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 800 000 0000" required /></label>
        <label className="field"><span className="label">Password</span><input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required /></label>
        {err && <div className="fraud" style={{ marginBottom: 14 }}><span>⚠</span><div>{err}</div></div>}
        <button className="btn primary block lg" disabled={busy}>{busy ? <><span className="spinner" /> Creating your wallet…</> : "Create account"}</button>
      </form>
      <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
    </AuthShell>
  );
}
