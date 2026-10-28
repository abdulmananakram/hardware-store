import { db } from "@/lib/db";
import type { AdjustmentType } from "@/lib/types";
import { round2 } from "@/lib/business";
import { ServiceError, type DbClient } from "./shared";

export const listInventoryMovements = () =>
  db.inventoryMovement.findMany({ orderBy: { createdAt: "desc" } });

export const adjustStock = async (input: {
  itemId: number;
  type: AdjustmentType;
  deltaInBaseUnit: number;
  reason: string;
}) =>
  db.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: input.itemId } });
    if (!item) throw new ServiceError("Item not found", 404);
    if (!input.reason.trim()) throw new ServiceError("Adjustment reason is required");
    const nextQty = round2(item.qtyInBaseUnit + input.deltaInBaseUnit);
    if (nextQty < 0) throw new ServiceError("Stock cannot become negative");

    await tx.item.update({
      where: { id: item.id },
      data: { qtyInBaseUnit: nextQty },
    });
    const adjustment = await tx.stockAdjustment.create({
      data: {
        itemId: item.id,
        type: input.type,
        deltaInBaseUnit: input.deltaInBaseUnit,
        newQtyInBaseUnit: nextQty,
        reason: input.reason.trim(),
      },
    });
    await tx.inventoryMovement.create({
      data: {
        itemId: item.id,
        type: input.deltaInBaseUnit >= 0 ? "adjustment_pos" : "adjustment_neg",
        deltaInBaseUnit: input.deltaInBaseUnit,
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

