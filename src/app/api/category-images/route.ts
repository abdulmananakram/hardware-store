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
const updateSchema = z.object({
  categoryId: z.number().int().positive(),
  imageId: z.number().int().positive(),
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

export async function PATCH(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await db.$transaction(async (tx) => {
      const image = await tx.categoryImage.findFirst({
        where: { id: parsed.data.imageId, categoryId: parsed.data.categoryId },
      });
      if (!image) throw new Error("Category image not found");
      await tx.categoryImage.updateMany({
        where: { categoryId: image.categoryId },
        data: { isDefault: false },
      });
      await tx.categoryImage.update({ where: { id: image.id }, data: { isDefault: true } });
      return tx.category.update({
        where: { id: image.categoryId },
        data: { defaultImageUrl: image.url, imageUrl: image.url },
      });
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const imageId = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(imageId) || imageId <= 0) {
    return NextResponse.json({ error: true, message: "Invalid image id" }, { status: 400 });
  }
  try {
    return NextResponse.json(await db.$transaction(async (tx) => {
      const image = await tx.categoryImage.findUnique({ where: { id: imageId } });
      if (!image) throw new Error("Category image not found");
      await tx.categoryImage.delete({ where: { id: imageId } });
      const next = image.isDefault
        ? await tx.categoryImage.findFirst({
            where: { categoryId: image.categoryId },
            orderBy: { createdAt: "asc" },
          })
        : null;
      if (next) {
        await tx.categoryImage.update({ where: { id: next.id }, data: { isDefault: true } });
      }
      await tx.category.update({
        where: { id: image.categoryId },
        data: { defaultImageUrl: next?.url ?? null, imageUrl: next?.url ?? null },
      });
      await tx.item.updateMany({ where: { photoUrl: image.url }, data: { photoUrl: null } });
      return { ok: true };
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
