// Billers available in the "Pay bill" dropdown. Category decides the channel —
// betting billers count as gambling for the AI risk engine + credit model.
export interface Biller { id: string; name: string; category: "airtime" | "bill" | "betting"; icon: string; }

export const BILLERS: Biller[] = [
  { id: "mtn", name: "MTN Airtime", category: "airtime", icon: "📶" },
  { id: "airtel", name: "Airtel Airtime", category: "airtime", icon: "📶" },
  { id: "glo", name: "Glo Data", category: "airtime", icon: "🌐" },
  { id: "dstv", name: "DSTV Subscription", category: "bill", icon: "📺" },
  { id: "ikeja", name: "Ikeja Electric", category: "bill", icon: "💡" },
  { id: "ekedc", name: "EKEDC Electricity", category: "bill", icon: "💡" },
  { id: "lawma", name: "LAWMA Waste Bill", category: "bill", icon: "🧾" },
  { id: "betking", name: "BetKing", category: "betting", icon: "🎲" },
  { id: "bet9ja", name: "Bet9ja", category: "betting", icon: "🎲" },
  { id: "sporty", name: "SportyBet", category: "betting", icon: "🎲" },
];

export const CATEGORY_CHANNEL: Record<Biller["category"], string> = {
  airtime: "airtime",
  bill: "bill",
  betting: "betting",
};
