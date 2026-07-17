import Link from "next/link";
import { PROVIDERS } from "@/lib/models";

export default function WalletIndex() {
  return (
    <main className="wrap" style={{ paddingTop: 44, paddingBottom: 60 }}>
      <span className="eyebrow" style={{ color: "#1a936f" }}>Mobile money</span>
      <h1 className="h-serif" style={{ fontSize: 38, margin: "10px 0 6px", fontWeight: 600 }}>Open a wallet</h1>
      <p className="muted" style={{ maxWidth: "60ch", marginTop: 0 }}>
        Pick a provider and open an account. Then use it like a real wallet — income, airtime, bills, transfers, betting.
        Your activity here is the data Reputify scores (with your consent).
      </p>
      <div className="steps" style={{ marginTop: 24 }}>
        {PROVIDERS.map((p) => (
          <Link key={p.id} href={`/wallet/${p.id}`} className="rolecard" style={{ borderTopColor: p.color, borderTopWidth: 3 }}>
            <div className="ic" style={{ background: p.color + "22", color: p.color }}>📱</div>
            <h3>{p.name}</h3>
            <p>Sign up or sign in to your {p.name} wallet.</p>
            <span className="go" style={{ color: p.color }}>Open {p.name} →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
