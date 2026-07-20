"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/borrower", label: "Borrower app" },
  { href: "/lender", label: "Lender dashboard" },
  { href: "/attester", label: "Attester ops" },
  { href: "/rep", label: "Live status" },
];

export function RepNav() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="wrap row">
        <Link href="/" className="brand"><span className="dot">R</span><span>Reputify<small>on Hedera</small></span></Link>
        <nav className="navlinks">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={pathname === l.href ? { color: "var(--ink)", fontWeight: 700 } : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
