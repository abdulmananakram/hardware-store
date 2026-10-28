import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { createPurchase } from "@/server/services/purchaseService";

const schema = z.object({
  uuid: z.string().uuid(),
  supplierId: z.number().int().positive(),
  paymentType: z.enum(["cash", "udhaar"]),
  amountPaid: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  lines: z.array(z.object({
    itemId: z.number().int().positive(),
    unitId: z.number().int().positive(),
    qty: z.number().positive(),
    unitCost: z.number().nonnegative(),
  })).min(1),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await db.purchaseBill.findMany({ include: { lines: true }, orderBy: { billDate: "desc" } }));
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await createPurchase(parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

