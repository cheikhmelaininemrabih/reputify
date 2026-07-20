// Reputation assembly (roadmap §8/§9). Built from what World A + the LoanRegistry
// actually expose: attestation counts/periods (HCS) and repayment history
// (contract reads). Raw cash-flow figures are NOT here — they sit encrypted
// off-chain and require selective disclosure (see lib/disclosure.ts). The UI
// shows only plain-language state; never a hash, timestamp, or HBAR.
import { attestationsForSubject } from "./attestation";
import { LoanRegistry } from "./contracts";
import { rdb } from "./rep-db";

export interface Reputation {
  borrowerId: string;
  name: string;
  monthsOfHistory: number;
  providersConnected: number;
  attestations: number;
  loansRepaid: number;
  loansDefaulted: number;
  loansActive: number;
  standing: string; // one plain-language line for the borrower's "Your standing"
}

export function assembleReputation(borrowerId: string): Reputation | null {
  const b = rdb.borrowers[borrowerId];
  if (!b) return null;
  const atts = attestationsForSubject(borrowerId);
  const periods = new Set(atts.map((a) => a.period));
  const providers = Object.values(rdb.connections).filter((c) => c.borrowerId === borrowerId && c.status === "approved" && !c.revoked);
  const loans = LoanRegistry.forBorrower(borrowerId);
  const repaid = loans.filter((l) => l.state === "Repaid").length;
  const defaulted = loans.filter((l) => l.state === "Defaulted").length;
  const active = loans.filter((l) => l.state === "Active").length;

  const bits = [
    `${providers.length} provider${providers.length === 1 ? "" : "s"} connected`,
    `${periods.size} month${periods.size === 1 ? "" : "s"} of history`,
  ];
  if (repaid) bits.push(`${repaid} loan${repaid === 1 ? "" : "s"} repaid on time`);
  if (defaulted) bits.push(`${defaulted} default${defaulted === 1 ? "" : "s"}`);

  return {
    borrowerId,
    name: b.name,
    monthsOfHistory: periods.size,
    providersConnected: providers.length,
    attestations: atts.length,
    loansRepaid: repaid,
    loansDefaulted: defaulted,
    loansActive: active,
    standing: bits.join(" · "),
  };
}
