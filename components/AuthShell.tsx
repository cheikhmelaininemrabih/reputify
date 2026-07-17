import Link from "next/link";

export function AuthShell({
  brand, dot, headline, tagline, bullets, children, accent = "#b07d1e", accent2 = "#cf9a2f",
}: {
  brand: string; dot: string; headline: React.ReactNode; tagline: string;
  bullets: string[]; children: React.ReactNode; accent?: string; accent2?: string;
}) {
  return (
    <div className="auth" style={{ ["--accent" as string]: accent, ["--accent-2" as string]: accent2 } as React.CSSProperties}>
      <aside className="auth-brand">
        <Link href="/" className="b-logo"><span className="dot">{dot}</span>{brand}</Link>
        <div>
          <h1>{headline}</h1>
          <p className="auth-tag">{tagline}</p>
          <ul>
            {bullets.map((b, i) => <li key={i}><span className="ck">✓</span>{b}</li>)}
          </ul>
        </div>
        <div className="foot">Synthetic data · no real borrowers · anchored on Hedera</div>
      </aside>
      <main className="auth-form">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
