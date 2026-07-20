import { NextResponse } from "next/server";
import { getSubscription, subscribe, unsubscribe } from "@/lib/billing";

// GET ?lenderId= — current subscription state.
export async function GET(req: Request) {
  const lenderId = new URL(req.url).searchParams.get("lenderId");
  if (!lenderId) return NextResponse.json({ error: "lenderId is required" }, { status: 400 });
  return NextResponse.json({ subscription: getSubscription(lenderId) });
}

// POST { lenderId, cancel? } — static/mock: no real payment, just flips the flag.
export async function POST(req: Request) {
  try {
    const { lenderId, cancel } = (await req.json()) as { lenderId: string; cancel?: boolean };
    if (!lenderId) return NextResponse.json({ error: "lenderId is required" }, { status: 400 });
    if (cancel) {
      unsubscribe(lenderId);
      return NextResponse.json({ ok: true, subscription: getSubscription(lenderId) });
    }
    const sub = subscribe(lenderId);
    return NextResponse.json({ ok: true, subscription: sub });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
