import type { Metadata } from "next";
import "./globals.css";
import { HelpChat } from "@/components/HelpChat";

export const metadata: Metadata = {
  title: "Reputify — Portable reputation infrastructure on Hedera",
  description: "Bonded attesters post signed cash-flow attestations to Hedera. Lenders get a plain-language summary by default, and verify anything more against the on-chain hash — the real data stays off-chain and encrypted.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<HelpChat /></body>
    </html>
  );
}
