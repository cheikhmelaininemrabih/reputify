"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "./api";

const LINKS = [
  { href: "/borrower", label: "Borrower app" },
  { href: "/lender", label: "Lender dashboard" },
  { href: "/attester", label: "Attester ops" },
  { href: "/rep", label: "Live status" },
];

export function RepNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ role: string; name: string } | null | undefined>(undefined);

  useEffect(() => {
    api("/api/rep/session").then((r) => setSession(r.session)).catch(() => setSession(null));
  }, [pathname]);

  async function signOut() {
    await fetch("/api/rep/session", { method: "DELETE" });
    setSession(null);
    router.refresh();
    window.location.reload();
  }

  return (
    <header className="topbar">
      <div className="wrap row">
        <Link href="/" className="brand"><span className="dot">R</span><span>Reputify<small>on Hedera</small></span></Link>
        <nav className="navlinks" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={pathname === l.href ? { color: "var(--ink)", fontWeight: 700 } : undefined}>
              {l.label}
            </Link>
          ))}
          {session && (
            <span style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10, paddingLeft: 12, borderLeft: "1px solid var(--line-2)" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {session.name} <span style={{ textTransform: "capitalize" }}>({session.role})</span>
              </span>
              <button className="btn ghost" style={{ padding: "5px 11px", fontSize: 12.5 }} onClick={signOut}>Sign out</button>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
