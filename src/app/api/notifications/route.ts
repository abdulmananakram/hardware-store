import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";

const schema = z.object({ id: z.number().int().positive(), all: z.boolean().optional() });

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await db.appNotification.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function PATCH(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    if (parsed.data.all) {
      await db.appNotification.updateMany({ data: { isRead: true } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(await db.appNotification.update({
      where: { id: parsed.data.id },
      data: { isRead: true },
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

