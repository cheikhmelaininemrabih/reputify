import { NextResponse } from "next/server";
import { addTransaction } from "@/lib/wallets";

// POST — add a ledger line by hand. Body: { amount, description, category, at? }.
// amount sign carries direction (positive = money in, negative = money out).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { amount?: number; description?: string; category?: string; at?: string };
    if (typeof body.amount !== "number" || !body.description || !body.category) {
      return NextResponse.json({ error: "amount, description and category are required" }, { status: 400 });
    }
    const txn = addTransaction(params.id, {
      amount: body.amount, description: body.description, category: body.category as any, at: body.at,
    });
    return NextResponse.json({ ok: true, txn });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
