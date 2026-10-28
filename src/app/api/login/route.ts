import { NextRequest, NextResponse } from "next/server";
import { login, loginSchema, SESSION_COOKIE } from "@/server/auth";

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: true, message: "A valid PIN is required" }, { status: 400 });
  }
  const result = login(request, parsed.data.pin);
  if (!result.ok) {
    return NextResponse.json({ error: true, message: result.message }, { status: result.status });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

