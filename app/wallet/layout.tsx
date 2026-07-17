import { AppHeader } from "@/components/AppHeader";

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ["--accent" as string]: "#12a150", ["--accent-2" as string]: "#16b45a" } as React.CSSProperties}>
      <AppHeader brand="PayCircle" tag="mobile money" links={[{ href: "/wallet", label: "Providers" }]} />
      {children}
      <footer className="foot"><div className="wrap">PayCircle · mobile-money systems (OPay · Moniepoint · PalmPay) · demo</div></footer>
    </div>
  );
}
