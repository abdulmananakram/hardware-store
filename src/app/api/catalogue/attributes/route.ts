import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";

const schema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(1),
  urduName: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  options: z.array(z.object({
    value: z.string().min(1),
    urduValue: z.string().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  })).default([]),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const categoryId = Number(new URL(request.url).searchParams.get("categoryId"));
  return NextResponse.json(await db.catalogueAttribute.findMany({
    where: Number.isInteger(categoryId) ? { categoryId } : undefined,
    include: { options: true },
    orderBy: { sortOrder: "asc" },
  }));
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await db.catalogueAttribute.create({
      data: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name.trim(),
        urduName: parsed.data.urduName?.trim(),
        sortOrder: parsed.data.sortOrder ?? 0,
        options: {
          create: parsed.data.options.map((option) => ({
            value: option.value.trim(),
            urduValue: option.urduValue?.trim(),
            sortOrder: option.sortOrder ?? 0,
          })),
        },
      },
      include: { options: true },
    }), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
