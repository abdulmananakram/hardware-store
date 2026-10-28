import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { deactivateItem, updateItem } from "@/server/services/itemService";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  urduName: z.string().optional().nullable(),
  skuCode: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  specification: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional(),
  pricePerBaseUnit: z.number().nonnegative().optional(),
  lowStockThreshold: z.number().nonnegative().optional(),
  saleMode: z.enum(["QTY", "PACK", "WEIGHT", "AMOUNT_EST"]).optional(),
  fractionalPackAllowed: z.boolean().optional(),
  icon: z.string().optional(),
  photoUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

function getId(request: NextRequest) {
  const id = Number(new URL(request.url).pathname.split("/").pop());
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const id = getId(request);
  if (!id) return NextResponse.json({ error: true, message: "Invalid item id" }, { status: 400 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await updateItem(id, parsed.data));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const id = getId(request);
  if (!id) return NextResponse.json({ error: true, message: "Invalid item id" }, { status: 400 });
  try {
    return NextResponse.json(await deactivateItem(id));
  } catch (error) {
    return errorResponse(error);
  }
}
