import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";

const schema = z.object({
  categoryId: z.number().int().positive(),
  url: z.string().min(1),
  makeDefault: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const categoryId = Number(new URL(request.url).searchParams.get("categoryId"));
  return NextResponse.json(await db.categoryImage.findMany({
    where: Number.isInteger(categoryId) ? { categoryId } : undefined,
    orderBy: { createdAt: "desc" },
  }));
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await db.$transaction(async (tx) => {
      if (parsed.data.makeDefault) {
        await tx.categoryImage.updateMany({
          where: { categoryId: parsed.data.categoryId },
          data: { isDefault: false },
        });
      }
      const image = await tx.categoryImage.create({
        data: {
          categoryId: parsed.data.categoryId,
          url: parsed.data.url,
          isDefault: parsed.data.makeDefault ?? false,
        },
      });
      if (image.isDefault) {
        await tx.category.update({
          where: { id: image.categoryId },
          data: { defaultImageUrl: image.url, imageUrl: image.url },
        });
      }
      return image;
    }), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

