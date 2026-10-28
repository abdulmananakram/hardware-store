import { NextRequest, NextResponse } from "next/server";
import { logout, SESSION_COOKIE } from "@/server/auth";

export async function POST(request: NextRequest) {
  logout(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

