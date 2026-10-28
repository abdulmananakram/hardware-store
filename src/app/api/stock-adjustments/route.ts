import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { adjustStock, listInventoryMovements, reconcileInventory } from "@/server/services/inventoryService";

const schema = z.object({
  itemId: z.number().int().positive(),
  type: z.enum(["restock", "correction", "damage", "loss", "initial"]),
  deltaInBaseUnit: z.number(),
  countedQtyInBaseUnit: z.number().nonnegative().optional(),
  reason: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  if (new URL(request.url).searchParams.get("reconcile") === "true") {
    const rawItemId = new URL(request.url).searchParams.get("itemId");
    const itemId = rawItemId ? Number(rawItemId) : undefined;
    if (itemId !== undefined && (!Number.isInteger(itemId) || itemId <= 0)) {
      return NextResponse.json({ error: true, message: "Invalid item id" }, { status: 400 });
    }
    return NextResponse.json(await reconcileInventory(itemId));
  }
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
