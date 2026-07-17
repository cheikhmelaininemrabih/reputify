import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  destroySession("remi");
  return NextResponse.json({ ok: true });
}
