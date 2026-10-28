import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { createSale } from "@/server/services/salesService";

const lineSchema = z.object({
  itemId: z.number().int().positive(),
  unitId: z.number().int().positive(),
  qty: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
  saleMode: z.enum(["QTY", "PACK", "WEIGHT", "AMOUNT_EST"]).optional(),
  measuredWeight: z.number().positive().optional(),
  estimatedWeight: z.object({
    ratePerKg: z.number().positive(),
    saleAmount: z.number().positive(),
  }).optional(),
});
const schema = z.object({
  uuid: z.string().uuid(),
  customerId: z.number().int().positive().nullable().optional(),
  paymentType: z.enum(["cash", "udhaar", "partial"]),
  amountPaid: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await db.saleBill.findMany({ include: { lines: true }, orderBy: { billDate: "desc" } }));
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await createSale(parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
