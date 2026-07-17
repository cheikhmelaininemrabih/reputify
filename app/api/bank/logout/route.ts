import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  destroySession("bank");
  return NextResponse.json({ ok: true });
}
