import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { adjustStock, listInventoryMovements } from "@/server/services/inventoryService";

const schema = z.object({
  itemId: z.number().int().positive(),
  type: z.enum(["restock", "correction", "damage", "loss", "initial"]),
  deltaInBaseUnit: z.number(),
  reason: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await listInventoryMovements());
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await adjustStock(parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

