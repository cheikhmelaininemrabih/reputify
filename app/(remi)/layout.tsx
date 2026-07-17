import { AppHeader } from "@/components/AppHeader";

export default function ReputifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ["--accent" as string]: "#b07d1e", ["--accent-2" as string]: "#cf9a2f" } as React.CSSProperties}>
      <AppHeader brand="Reputify" tag="credit passport" links={[{ href: "/dashboard", label: "Dashboard" }]} showChain />
      {children}
      <footer className="foot"><div className="wrap">Reputify · credit-identity layer on Hedera · synthetic data, no real borrowers</div></footer>
    </div>
  );
}
