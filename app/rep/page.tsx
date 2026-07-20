"use client";
// Demo hub for the attestation-and-lending system (the technical roadmap).
// Links to the three client surfaces and shows the on-chain mode.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/components/api";
import { RepNav } from "@/components/RepNav";

export default function RepHub() {
  const [mode, setMode] = useState<string>("…");
  const [counts, setCounts] = useState({ borrowers: 0, attesters: 0, loans: 0, challenges: 0, attestations: 0 });

  async function refresh() {
    const s = await api("/api/rep/state");
    setMode(s.mode);
    setCounts({
      borrowers: s.borrowers.length, attesters: s.attesters.length,
      loans: s.loans.length, challenges: s.challenges.length, attestations: s.attestations,
    });
  }
  useEffect(() => { refresh().catch(() => {}); }, []);

  const surfaces = [
    { href: "/borrower", title: "Borrower app", body: "Connect providers, see your standing, approve lender requests. The chain is invisible." },
    { href: "/lender", title: "Lender dashboard", body: "Search a borrower, request granular access, verify, and decide." },
    { href: "/attester", title: "Attester ops", body: "Bond status and the attestations the minting job has posted." },
  ];

  return (
    <main>
      <RepNav />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 22px" }}>
      <p style={{ color: "var(--muted)", fontWeight: 600, letterSpacing: ".02em" }}>Reputify · attestation network</p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 34, margin: "6px 0 10px" }}>
        Portable reputation, on-chain facts, off-chain money
      </h1>
      <p style={{ color: "var(--ink-2)", fontSize: 16, maxWidth: 640 }}>
        Two decoupled on-chain worlds — an append-only attestation log and the bond/loan/slashing
        contracts — joined by the backend. Nothing about a loan&apos;s value is on-chain.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0 30px" }}>
        <span className="pill" style={pill}>Mode: <b>{mode}</b></span>
        <span className="pill" style={pill}>{counts.borrowers} borrowers</span>
        <span className="pill" style={pill}>{counts.attesters} attesters</span>
        <span className="pill" style={pill}>{counts.attestations} attestations</span>
        <span className="pill" style={pill}>{counts.loans} loans</span>
        <span className="pill" style={pill}>{counts.challenges} disputes</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        {surfaces.map((s) => (
          <Link key={s.href} href={s.href} className="card hover pad" style={{ textDecoration: "none", color: "inherit" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{s.title}</h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5 }}>{s.body}</p>
          </Link>
        ))}
      </div>

      <button
        className="btn ghost"
        style={{ marginTop: 26 }}
        onClick={async () => {
          await api("/api/rep/state", { reset: true });
          await fetch("/api/rep/session", { method: "DELETE" }); // reset wipes every identity — any signed-in session is now stale
          await refresh();
        }}
      >
        Reset demo data
      </button>
      </div>
    </main>
  );
}

const pill: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: "var(--r-full)",
  padding: "6px 13px", fontSize: 13.5, boxShadow: "var(--sh-sm)",
};
