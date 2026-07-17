import type { Metadata } from "next";
import "./globals.css";
import { HelpChat } from "@/components/HelpChat";

export const metadata: Metadata = {
  title: "Reputify — Portable credit identity on Hedera",
  description: "Three connected systems on Hedera: a mobile-money wallet, a credit-identity layer, and a bank portal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<HelpChat /></body>
    </html>
  );
}
