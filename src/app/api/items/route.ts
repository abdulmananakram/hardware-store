import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { createItem, listItems } from "@/server/services/itemService";

const itemSchema = z.object({
  name: z.string().min(1),
  urduName: z.string().optional(),
  skuCode: z.string().optional(),
  brand: z.string().optional(),
  specification: z.string().optional(),
  notes: z.string().optional(),
  categoryId: z.number().int().positive(),
  baseUnitName: z.string().min(1),
  pricePerBaseUnit: z.number().nonnegative(),
  costPerBaseUnit: z.number().nonnegative().optional(),
  lowStockThreshold: z.number().nonnegative(),
  saleMode: z.enum(["QTY", "PACK", "WEIGHT", "AMOUNT_EST"]).optional(),
  fractionalPackAllowed: z.boolean().optional(),
  icon: z.string().optional(),
  initialQtyInBaseUnit: z.number().nonnegative().optional(),
  photoUrl: z.string().optional(),
  extraUnits: z.array(z.object({
    unitName: z.string().min(1),
    conversionToBase: z.number().positive(),
  })).optional(),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await listItems());
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = itemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await createItem(parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
