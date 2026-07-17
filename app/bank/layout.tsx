import { AppHeader } from "@/components/AppHeader";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ["--accent" as string]: "#2f5fd0", ["--accent-2" as string]: "#3f74ea" } as React.CSSProperties}>
      <AppHeader brand="LenderHub" tag="bank portal" />
      {children}
      <footer className="foot"><div className="wrap">LenderHub · lender console · queries consented Passports, verifies on Hedera</div></footer>
    </div>
  );
}
