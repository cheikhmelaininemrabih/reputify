import Link from "next/link";

export default function Hub() {
  return (
    <main>
      <header className="topbar">
        <div className="wrap row">
          <Link href="/" className="brand"><span className="dot">R</span><span>Reputify<small>on Hedera</small></span></Link>
          <nav className="navlinks">
            <Link href="/borrower">Borrower app</Link>
            <Link href="/lender">Lender dashboard</Link>
            <Link href="/attester">Attester ops</Link>
            <Link href="/rep" style={{ color: "var(--muted)" }}>Live status</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <span className="badge">◆ Portable reputation infrastructure on Hedera</span>
          <h1>We don&apos;t score anyone. We give lenders <span className="gradient-text">proof they can trust</span>.</h1>
          <p className="sub">
            Bonded attesters post signed cash-flow attestations to a public Hedera log — a hash only, never
            the data. A lender sees a plain-language summary by default; if they need more, the borrower
            approves it, and what they receive is independently re-hashed and checked against the on-chain
            record before it&apos;s trusted. The real numbers stay off-chain and encrypted the whole time.
          </p>
          <div className="cta">
            <Link href="/borrower" className="btn primary lg">Open the borrower app →</Link>
            <Link href="/lender" className="btn ghost lg">Open the lender dashboard</Link>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 22 }}>
        <div className="systems">
          <SysCard href="/borrower" ic="🙋" title="Borrower app" tag="Reputify" c="#b07d1e">
            Connect a mobile-money provider, see your standing in plain language, and approve or deny
            lenders who ask for a closer look. The chain is invisible from here.
          </SysCard>
          <SysCard href="/lender" ic="🏦" title="Lender dashboard" tag="LenderHub" c="#2f5fd0">
            Search a borrower, see the free summary, request granular access, and verify what comes back
            against the hash anchored on Hedera before you decide.
          </SysCard>
          <SysCard href="/attester" ic="⚖️" title="Attester ops" tag="Reputify network" c="#7a3fd0">
            Bonded attesters sign and post throughput attestations. A fraud challenge that's upheld slashes
            the lying attester's stake — the incentive that keeps attestations honest.
          </SysCard>
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 64, marginBottom: 20 }}>
        <div style={{ textAlign: "center", maxWidth: "60ch", margin: "0 auto 30px" }}>
          <span className="eyebrow">How it works</span>
          <h2 style={{ fontSize: 32, margin: "10px 0" }}>On-chain facts, off-chain money</h2>
          <p className="muted">
            What&apos;s private stays private. Only a cryptographic <span className="onchainmark">hash</span> of
            each attestation is anchored on Hedera — the real cash-flow package is encrypted to the
            borrower&apos;s key and only ever released with their consent.
          </p>
        </div>
        <div className="steps">
          <Step n="01">Borrower connects a provider — a mock PSP stands in for OPay/Moniepoint/PalmPay OAuth.</Step>
          <Step n="02" chain>A bonded attester signs a cash-flow attestation and posts its hash to HCS.</Step>
          <Step n="03">The lender's default view is a plain-language summary — months of history, providers, repayment record. No raw numbers.</Step>
          <Step n="04">Lender requests granular access. Nothing moves until the borrower taps Allow.</Step>
          <Step n="05" chain>The released package is re-hashed and checked against the attestation on Hedera — &quot;Verified ✓&quot; only if it matches.</Step>
          <Step n="06" chain>Loans, repayment, and slashing are recorded against attestation sequence numbers — a lying attester's bond gets slashed if a challenge is upheld.</Step>
        </div>
      </section>

      <footer className="foot"><div className="wrap">Reputify · portable reputation infrastructure on Hedera · investor prototype — synthetic data, no real borrowers</div></footer>
    </main>
  );
}

function SysCard({ href, ic, title, tag, c, children }: { href: string; ic: string; title: string; tag: string; c: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="card hover syscard" style={{ ["--accent" as string]: c } as React.CSSProperties}>
      <div className="ic" style={{ background: c + "18", color: c }}>{ic}</div>
      <span className="label" style={{ color: c }}>{tag}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      <span className="go" style={{ color: c }}>Open →</span>
    </Link>
  );
}
function Step({ n, chain, children }: { n: string; chain?: boolean; children: React.ReactNode }) {
  return (
    <div className="card step">
      <div className="n">{n} {chain ? <span className="onchainmark">· on-chain</span> : <span className="muted">· off-chain</span>}</div>
      <p>{children}</p>
    </div>
  );
}
