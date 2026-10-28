import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { ServiceError } from "@/server/services/shared";

const schema = z.object({ name: z.string().min(1), icon: z.string().optional() });

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await db.category.findMany({ include: { images: true }, orderBy: { name: "asc" } }));
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await db.category.create({
      data: { name: parsed.data.name.trim(), icon: parsed.data.icon ?? "📦" },
      include: { images: true },
    }), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: true, message: "Invalid category id" }, { status: 400 });
  try {
    const result = await db.$transaction(async (tx) => {
      const activeItems = await tx.item.count({ where: { categoryId: id, isActive: true } });
      if (activeItems > 0) throw new ServiceError("Category still has active items");
      await tx.category.delete({ where: { id } });
      return { ok: true };
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

