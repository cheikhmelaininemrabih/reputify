import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { publicUser } from "@/lib/present";

export async function POST(req: Request) {
  const { phone, password } = (await req.json()) as { phone: string; password: string };
  const user = Object.values(db.users).find((u) => u.phone === phone);
  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
  }
  createSession(user.id, "remi");
  return NextResponse.json({ ok: true, user: publicUser(user) });
}
