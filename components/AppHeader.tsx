import Link from "next/link";
import { ChainStatus } from "./ChainStatus";

export function AppHeader({
  brand, tag, links = [], showChain = false,
}: {
  brand: string; tag: string;
  links?: { href: string; label: string }[]; showChain?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="wrap row">
        <Link href="/" className="brand">
          <span className="dot">{brand[0]}</span>
          <span>{brand}<small>{tag}</small></span>
        </Link>
        <nav className="navlinks">
          {links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          <Link href="/" style={{ color: "var(--muted)" }}>All systems ↗</Link>
          {showChain && <ChainStatus />}
        </nav>
      </div>
    </header>
  );
}
