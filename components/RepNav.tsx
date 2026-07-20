"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getIdentity, clearIdentity, type Identity } from "./identity";

const LINKS = [
  { href: "/borrower", label: "Borrower app" },
  { href: "/lender", label: "Lender dashboard" },
  { href: "/attester", label: "Attester ops" },
  { href: "/rep", label: "Live status" },
];

export function RepNav() {
  const pathname = usePathname();
  const [identity, setIdentityState] = useState<Identity | null>(null);

  useEffect(() => {
    setIdentityState(getIdentity());
    const onFocus = () => setIdentityState(getIdentity());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pathname]);

  function signOut() {
    clearIdentity();
    setIdentityState(null);
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
          {identity && (
            <span style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10, paddingLeft: 12, borderLeft: "1px solid var(--line-2)" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {identity.name} <span style={{ textTransform: "capitalize" }}>({identity.role})</span>
              </span>
              <button className="btn ghost" style={{ padding: "5px 11px", fontSize: 12.5 }} onClick={signOut}>Sign out</button>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
