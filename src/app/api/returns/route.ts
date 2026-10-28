import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { createCustomerReturn, createSupplierReturn } from "@/server/services/returnService";

const schema = z.object({
  saleBillLineId: z.number().int().positive(),
  qtyReturnedInBaseUnit: z.number().positive(),
  reason: z.string().min(1),
  disposition: z.enum(["back_to_sellable_stock", "damaged_pile"]),
});
const supplierSchema = z.object({
  purchaseBillLineId: z.number().int().positive(),
  qtyReturnedInBaseUnit: z.number().positive(),
  reason: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await db.return.findMany({ orderBy: { returnDate: "desc" } }));
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const body = await request.json().catch(() => null);
  const supplier = supplierSchema.safeParse(body);
  if (supplier.success) {
    try { return NextResponse.json(await createSupplierReturn(supplier.data), { status: 201 }); }
    catch (error) { return errorResponse(error); }
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await createCustomerReturn(parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
