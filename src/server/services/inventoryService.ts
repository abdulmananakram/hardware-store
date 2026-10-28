import { db } from "@/lib/db";
import type { AdjustmentType } from "@/lib/types";
import { round2 } from "@/lib/business";
import { ServiceError, type DbClient } from "./shared";

export const INVENTORY_MOVEMENT_TYPES = [
  "OPENING",
  "PURCHASE_IN",
  "SALE_OUT",
  "CUSTOMER_RETURN_IN",
  "SUPPLIER_RETURN_OUT",
  "DAMAGE_OUT",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "REVERSAL",
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export function reconcileQuantities(
  cachedQty: number,
  movements: number[]
): { ledgerQty: number; difference: number; reconciled: boolean } {
  const ledgerQty = round2(movements.reduce((sum, delta) => sum + delta, 0));
  const difference = round2(cachedQty - ledgerQty);
  return { ledgerQty, difference, reconciled: difference === 0 };
}

export const listInventoryMovements = () =>
  db.inventoryMovement.findMany({ orderBy: { createdAt: "desc" } });

export async function reconcileInventory(itemId?: number) {
  const items = await db.item.findMany({
    where: itemId ? { id: itemId } : undefined,
    select: { id: true, name: true, qtyInBaseUnit: true },
  });
  const movements = await db.inventoryMovement.findMany({
    where: itemId ? { itemId } : undefined,
    select: { itemId: true, deltaInBaseUnit: true },
  });
  const movementTotals = new Map<number, number>();
  for (const movement of movements) {
    movementTotals.set(
      movement.itemId,
      round2((movementTotals.get(movement.itemId) ?? 0) + movement.deltaInBaseUnit)
    );
  }
  return items.map((item) => {
    const ledgerQty = movementTotals.get(item.id) ?? 0;
    return {
      itemId: item.id,
      name: item.name,
      cachedQtyInBaseUnit: item.qtyInBaseUnit,
      ledgerQtyInBaseUnit: ledgerQty,
      difference: round2(item.qtyInBaseUnit - ledgerQty),
      reconciled: round2(item.qtyInBaseUnit - ledgerQty) === 0,
    };
  });
}

export const adjustStock = async (input: {
  itemId: number;
  type: AdjustmentType;
  deltaInBaseUnit: number;
  reason: string;
  countedQtyInBaseUnit?: number;
}) =>
  db.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: input.itemId } });
    if (!item) throw new ServiceError("Item not found", 404);
    if (!input.reason.trim()) throw new ServiceError("Adjustment reason is required");
    const delta = input.countedQtyInBaseUnit === undefined
      ? input.deltaInBaseUnit
      : round2(input.countedQtyInBaseUnit - item.qtyInBaseUnit);
    const nextQty = round2(item.qtyInBaseUnit + delta);
    if (nextQty < 0) throw new ServiceError("Stock cannot become negative");

    await tx.item.update({
      where: { id: item.id },
      data: { qtyInBaseUnit: nextQty },
    });
    const adjustment = await tx.stockAdjustment.create({
      data: {
        itemId: item.id,
        type: input.type,
        deltaInBaseUnit: delta,
        newQtyInBaseUnit: nextQty,
        reason: input.reason.trim(),
        systemQtyInBaseUnit: item.qtyInBaseUnit,
        countedQtyInBaseUnit: input.countedQtyInBaseUnit,
      },
    });
    await tx.inventoryMovement.create({
      data: {
        itemId: item.id,
        type: delta >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        deltaInBaseUnit: delta,
        newQtyInBaseUnit: nextQty,
        referenceType: "adjustment",
        referenceId: adjustment.id,
        reason: input.reason.trim(),
      },
    });
    await tx.auditLog.create({
      data: {
        action: "stock_adjustment",
        entityType: "item",
        entityId: item.id,
        details: JSON.stringify(input),
        reason: input.reason.trim(),
      },
    });
    return adjustment;
  });

export const recordMovement = async (
  tx: DbClient,
  input: {
    itemId: number;
    type: string;
    deltaInBaseUnit: number;
    newQtyInBaseUnit: number;
    referenceType: string;
    referenceId?: number;
    referenceUuid?: string;
    reason: string;
  }
) => tx.inventoryMovement.create({ data: input });
