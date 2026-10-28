import { db } from "@/lib/db";
import { calculateWeightedAverageCost, round2, toBase } from "@/lib/business";
import { getBalance, recordTransaction } from "./khataService";
import { normalizePayment, ServiceError, assertPositive } from "./shared";

export type CreatePurchaseInput = {
  uuid: string;
  supplierId: number;
  paymentType: "cash" | "udhaar";
  amountPaid?: number;
  paymentMethod?: string;
  lines: {
    itemId: number;
    unitId: number;
    qty: number;
    unitCost: number;
  }[];
};

export const createPurchase = async (input: CreatePurchaseInput) =>
  db.$transaction(async (tx) => {
    const existing = await tx.purchaseBill.findUnique({
      where: { uuid: input.uuid },
      include: { lines: true },
    });
    if (existing) return existing;
    if (!input.lines.length) throw new ServiceError("At least one purchase line is required");
    if (!(await tx.supplier.findUnique({ where: { id: input.supplierId } }))) {
      throw new ServiceError("Supplier not found", 404);
    }

    const prepared: Array<{
      itemId: number;
      unitId: number;
      qty: number;
      unitCost: number;
      qtyInBaseUnit: number;
      costPerBaseUnit: number;
      lineTotal: number;
      oldQty: number;
      oldCost: number;
    }> = [];
    for (const line of input.lines) {
      assertPositive(line.qty, "Quantity");
      if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
        throw new ServiceError("Purchase cost cannot be negative");
      }
      const item = await tx.item.findUnique({
        where: { id: line.itemId },
        include: { units: true },
      });
      if (!item || !item.isActive) throw new ServiceError("Item is not available", 404);
      const unit = item.units.find((candidate) => candidate.id === line.unitId);
      if (!unit) throw new ServiceError("Purchase unit not found");
      const qtyInBaseUnit = toBase(
        {
          ...item,
          urduName: item.urduName ?? undefined,
          photoUrl: item.photoUrl ?? undefined,
          costPerBaseUnit: item.costPerBaseUnit ?? undefined,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          units: item.units.map((candidate) => ({
            ...candidate,
            createdAt: candidate.createdAt.toISOString(),
          })),
        },
        line.unitId,
        line.qty
      );
      const costPerBaseUnit = round2(line.unitCost / unit.conversionToBase);
      prepared.push({
        ...line,
        qtyInBaseUnit,
        unitId: unit.id,
        costPerBaseUnit,
        lineTotal: round2(line.qty * line.unitCost),
        oldQty: item.qtyInBaseUnit,
        oldCost: item.costPerBaseUnit ?? 0,
      });
    }

    const total = round2(prepared.reduce((sum, line) => sum + line.lineTotal, 0));
    const payment = normalizePayment(total, input.paymentType, input.amountPaid);
    const bill = await tx.purchaseBill.create({
      data: {
        uuid: input.uuid,
        supplierId: input.supplierId,
        paymentType: input.paymentType,
        totalAmount: total,
        ...payment,
        paymentMethod: input.paymentMethod,
      },
    });
    for (const line of prepared) {
      const nextQty = round2(line.oldQty + line.qtyInBaseUnit);
      const nextCost = calculateWeightedAverageCost(
        line.oldQty,
        line.oldCost,
        line.qtyInBaseUnit,
        line.costPerBaseUnit
      );
      await tx.item.update({
        where: { id: line.itemId },
        data: { qtyInBaseUnit: nextQty, costPerBaseUnit: nextCost },
      });
      await tx.purchaseBillLine.create({
        data: {
          purchaseBillId: bill.id,
          itemId: line.itemId,
          unitId: line.unitId,
          qtyInPurchasedUnit: line.qty,
          qtyInBaseUnit: line.qtyInBaseUnit,
          unitCost: line.unitCost,
          costPerBaseUnit: line.costPerBaseUnit,
          lineTotal: line.lineTotal,
          conversionToBaseSnapshot: line.qtyInBaseUnit / line.qty,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          itemId: line.itemId,
          type: "purchase",
          deltaInBaseUnit: line.qtyInBaseUnit,
          newQtyInBaseUnit: nextQty,
          referenceType: "purchase_bill",
          referenceId: bill.id,
          referenceUuid: bill.uuid,
          reason: "Purchase received",
        },
      });
    }
    if (payment.outstandingAmount > 0) {
      await recordTransaction(tx, {
        partyType: "supplier",
        partyId: input.supplierId,
        transactionType: "payable_incurred",
        amount: payment.outstandingAmount,
        relatedPurchaseBillId: bill.id,
        note: "Purchase outstanding balance",
      });
      await tx.supplier.update({
        where: { id: input.supplierId },
        data: { payableBalance: await getBalance("supplier", input.supplierId, tx) },
      });
    }
    await tx.auditLog.create({
      data: {
        action: "purchase_created",
        entityType: "purchase_bill",
        entityId: bill.id,
        details: JSON.stringify({ uuid: bill.uuid, total }),
      },
    });
    return tx.purchaseBill.findUniqueOrThrow({ where: { id: bill.id }, include: { lines: true } });
  });
