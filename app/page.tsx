import Link from "next/link";

export default function Hub() {
  return (
    <main>
      <header className="topbar">
        <div className="wrap row">
          <Link href="/" className="brand"><span className="dot">R</span><span>Reputify<small>on Hedera</small></span></Link>
          <nav className="navlinks">
            <Link href="/wallet">Wallet</Link>
            <Link href="/bank">For banks</Link>
            <Link href="/login" className="btn ghost" style={{ padding: "8px 16px" }}>Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <span className="badge">◆ Alternative credit infrastructure on Hedera</span>
          <h1>Credit identity for the <span className="gradient-text">33 million</span> who don&apos;t have one.</h1>
          <p className="sub">A mobile-money wallet you actually use, a credit layer that scores your real activity, and a bank that trusts the result — connected on-chain, private by default.</p>
          <div className="cta">
            <Link href="/signup" className="btn primary lg">Create your account →</Link>
            <Link href="/wallet" className="btn ghost lg">Explore the wallet</Link>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 22 }}>
        <div className="systems">
          <SysCard href="/wallet" ic="📱" title="Mobile-money wallet" tag="PayCircle" c="#12a150">
            Open an account and use it for real — income, airtime, bills, betting, transfers — with live AI fraud detection. This is where your financial story is written.
          </SysCard>
          <SysCard href="/signup" ic="🪪" title="Credit identity" tag="Reputify" c="#b07d1e">
            Sign up, get a Hedera wallet and DID, pass KYC once, connect your wallet, and build a Passport that banks can trust.
          </SysCard>
          <SysCard href="/bank" ic="🏦" title="Bank portal" tag="LenderHub" c="#2f5fd0">
            Lenders review a pool of consented applicants, see the score and risk signals, and decide who to approve — without ever seeing raw data.
          </SysCard>
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 64, marginBottom: 20 }}>
        <div style={{ textAlign: "center", maxWidth: "60ch", margin: "0 auto 30px" }}>
          <span className="eyebrow">How it works</span>
          <h2 style={{ fontSize: 32, margin: "10px 0" }}>Six steps, one chain</h2>
          <p className="muted">What&apos;s private stays off-chain. Only cryptographic <span className="onchainmark">commitments</span> are anchored on Hedera.</p>
        </div>
        <div className="steps">
          <Step n="01">Use the <b>wallet</b> — income, bills, transfers, betting. AI flags risky patterns live.</Step>
          <Step n="02" chain>Create a <b>Reputify</b> account — a Hedera wallet + DID, minted and anchored.</Step>
          <Step n="03" chain>Pass <b>KYC</b> — a Verifiable Credential is issued and anchored.</Step>
          <Step n="04">Connect the wallet — Reputify scores your real activity: stability, gambling, fraud.</Step>
          <Step n="05" chain>Anchor the <b>Passport</b> and sign a scoped <b>consent</b> for one bank.</Step>
          <Step n="06" chain>The <b>bank</b> reviews and decides. It verifies the commitment on-chain.</Step>
        </div>
      </section>

      <footer className="foot"><div className="wrap">Reputify · alternative credit infrastructure on Hedera · investor prototype — synthetic data, no real borrowers</div></footer>
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
