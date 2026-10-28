import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { db } from "@/lib/db";
import { recordTransaction } from "@/server/services/khataService";
import { receivePayment } from "@/server/services/paymentService";

const schema = z.object({
  partyType: z.enum(["customer", "supplier"]),
  partyId: z.number().int().positive(),
  transactionType: z.enum(["credit_given", "customer_return_credit", "payment_received", "payable_incurred", "supplier_return_credit", "payment_made"]),
  amount: z.number().positive(),
  note: z.string().optional(),
});
const paymentSchema = z.object({
  partyType: z.enum(["customer", "supplier"]),
  partyId: z.number().int().positive(),
  amount: z.number().positive(),
  method: z.string().optional(),
  note: z.string().optional(),
  allocations: z.array(z.object({ billId: z.number().int().positive(), amount: z.number().positive() })).optional(),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await db.khataTransaction.findMany({ orderBy: { transactionDate: "desc" } }));
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const body = await request.json().catch(() => null);
  const payment = paymentSchema.safeParse(body);
  if (payment.success) {
    try { return NextResponse.json(await receivePayment(payment.data), { status: 201 }); }
    catch (error) { return errorResponse(error); }
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    const result = await db.$transaction(async (tx) => {
      const party = parsed.data.partyType === "customer"
        ? await tx.customer.findUnique({ where: { id: parsed.data.partyId } })
        : await tx.supplier.findUnique({ where: { id: parsed.data.partyId } });
      if (!party) throw new Error("Party not found");
      const entry = await recordTransaction(tx, parsed.data);
      return entry;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
