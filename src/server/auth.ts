import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const SESSION_COOKIE = "hardware_shop_session";
const sessions = new Set<string>();
const failures = new Map<string, { count: number; lockedUntil: number }>();

export const loginSchema = z.object({ pin: z.string().min(4).max(32) });

export const login = (request: NextRequest, pin: string) => {
  const key = request.headers.get("x-forwarded-for") ?? "local";
  const state = failures.get(key);
  if (state && state.lockedUntil > Date.now()) {
    return { ok: false as const, status: 429, message: "Too many attempts. Try again in one minute." };
  }
  if (pin !== process.env.APP_PIN) {
    const count = (state?.count ?? 0) + 1;
    failures.set(key, {
      count: count >= 5 ? 0 : count,
      lockedUntil: count >= 5 ? Date.now() + 60_000 : 0,
    });
    return { ok: false as const, status: 401, message: "Invalid PIN" };
  }
  failures.delete(key);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.add(token);
  return { ok: true as const, token };
};

export const isAuthenticated = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return !!token && sessions.has(token);
};

export const requireAuth = (request: NextRequest) => {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: true, message: "Authentication required" }, { status: 401 });
  }
  return null;
};

export const logout = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) sessions.delete(token);
};

