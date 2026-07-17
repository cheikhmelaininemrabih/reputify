import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  destroySession("provider");
  return NextResponse.json({ ok: true });
}
