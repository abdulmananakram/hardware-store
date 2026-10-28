import { db } from "@/lib/db";
import {
  calculateEstimatedWeightSale,
  checkBelowCost,
  round2,
  toBase,
} from "@/lib/business";
import { getBalance, recordTransaction } from "./khataService";
import { normalizePayment, ServiceError, assertPositive } from "./shared";

type SaleLineInput = {
  itemId: number;
  unitId: number;
  qty: number;
  unitPrice?: number;
  saleMode?: "QTY" | "PACK" | "WEIGHT" | "AMOUNT_EST";
  measuredWeight?: number;
  estimatedWeight?: { ratePerKg: number; saleAmount: number };
};

export type CreateSaleInput = {
  uuid: string;
  customerId?: number | null;
  paymentType: "cash" | "udhaar" | "partial";
  amountPaid?: number;
  paymentMethod?: string;
  lines: SaleLineInput[];
};

export const createSale = async (input: CreateSaleInput) =>
  db.$transaction(async (tx) => {
    const existing = await tx.saleBill.findUnique({
      where: { uuid: input.uuid },
      include: { lines: true },
    });
    if (existing) return existing;
    if (!input.uuid.trim() || input.lines.length === 0) {
      throw new ServiceError("A sale UUID and at least one line are required");
    }

    const prepared: Array<{
      itemId: number;
      unitId: number;
      qty: number;
      qtyInBaseUnit: number;
      unitPriceAtSale: number;
      lineTotal: number;
      saleMode: string;
      conversionToBaseSnapshot: number;
      isEstimatedWeight: boolean;
      ratePerKg?: number;
      unroundedGrams?: number;
      roundedGrams?: number;
      roundingPolicyVersion?: string;
      costSnapshot?: number;
      negotiatedPrice?: number;
      belowCost: boolean;
      belowCostWarning?: string;
    }> = [];

    for (const line of input.lines) {
      assertPositive(line.qty, "Quantity");
      const item = await tx.item.findUnique({
        where: { id: line.itemId },
        include: { units: true },
      });
      if (!item || !item.isActive) throw new ServiceError("Item is not available", 404);
      const unit = item.units.find((candidate) => candidate.id === line.unitId);
      if (!unit) throw new ServiceError("Sale unit not found", 400);

      let qtyInBaseUnit: number;
      let lineTotal: number;
      let saleMode = line.saleMode ?? (item.saleMode || "QTY");
      let estimated: Partial<(typeof prepared)[number]> = {};
      if (line.estimatedWeight || saleMode === "AMOUNT_EST") {
        if (!line.estimatedWeight) throw new ServiceError("Estimated sale requires amount and rate");
        const result = calculateEstimatedWeightSale(
          line.estimatedWeight.saleAmount,
          line.estimatedWeight.ratePerKg
        );
        qtyInBaseUnit =
          item.baseUnitName.toLowerCase() === "kg"
            ? round2(result.roundedGrams / 1000)
            : result.roundedGrams;
        lineTotal = result.lineTotal;
        saleMode = "AMOUNT_EST";
        estimated = {
          isEstimatedWeight: true,
          ratePerKg: line.estimatedWeight.ratePerKg,
          unroundedGrams: result.unroundedGrams,
          roundedGrams: result.roundedGrams,
          roundingPolicyVersion: "nearest-10g-half-up-v1",
        };
      } else {
        const price = line.unitPrice ?? item.pricePerBaseUnit;
        if (!Number.isFinite(price) || price < 0) {
          throw new ServiceError("Sale price cannot be negative");
        }
        if (saleMode === "WEIGHT") {
          assertPositive(line.measuredWeight ?? 0, "Measured weight");
        }
        qtyInBaseUnit = toBase(
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
          saleMode === "WEIGHT" ? line.measuredWeight! : line.qty
        );
        lineTotal = round2((saleMode === "WEIGHT" ? line.measuredWeight! : line.qty) * price);
        estimated = {
          isEstimatedWeight: false,
          negotiatedPrice: line.unitPrice === undefined ? undefined : price,
        };
      }

      const cost = item.costPerBaseUnit ?? undefined;
      const costCheck = checkBelowCost(
        line.estimatedWeight
          ? line.estimatedWeight.ratePerKg
          : line.unitPrice ?? item.pricePerBaseUnit,
        cost
      );
      prepared.push({
        itemId: item.id,
        unitId: unit.id,
        qty: line.qty,
        qtyInBaseUnit,
        unitPriceAtSale: round2(
          line.estimatedWeight
            ? line.estimatedWeight.ratePerKg
            : line.unitPrice ?? item.pricePerBaseUnit
        ),
        lineTotal,
        saleMode,
        conversionToBaseSnapshot: unit.conversionToBase,
        costSnapshot: cost,
        belowCost: costCheck.isBelowCost,
        belowCostWarning: costCheck.warning,
        ...estimated,
        isEstimatedWeight: estimated.isEstimatedWeight ?? false,
      });
    }

    const subtotal = round2(prepared.reduce((sum, line) => sum + line.lineTotal, 0));
    const total = Math.round(subtotal);
    const roundingAdjustment = round2(total - subtotal);
    const payment = normalizePayment(total, input.paymentType, input.amountPaid);
    if (payment.outstandingAmount > 0 && !input.customerId) {
      throw new ServiceError("A customer is required for unpaid or partial sales");
    }
    if (input.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new ServiceError("Customer not found", 404);
    }

    const bill = await tx.saleBill.create({
      data: {
        uuid: input.uuid,
        customerId: input.customerId ?? null,
        paymentType: input.paymentType,
        totalAmount: total,
        subtotalAmount: subtotal,
        roundingAdjustment,
        ...payment,
        paymentMethod: input.paymentMethod,
        lines: { create: [] },
      },
    });

    for (const line of prepared) {
      const updated = await tx.item.updateMany({
        where: {
          id: line.itemId,
          isActive: true,
          qtyInBaseUnit: { gte: line.qtyInBaseUnit },
        },
        data: { qtyInBaseUnit: { decrement: line.qtyInBaseUnit } },
      });
      if (updated.count !== 1) throw new ServiceError("Insufficient stock");
      const itemAfter = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });
      const createdLine = await tx.saleBillLine.create({
        data: {
          saleBillId: bill.id,
          itemId: line.itemId,
          unitId: line.unitId,
          qtyInSoldUnit: line.qty,
          qtyInBaseUnit: line.qtyInBaseUnit,
          unitPriceAtSale: line.unitPriceAtSale,
          lineTotal: line.lineTotal,
          saleMode: line.saleMode,
          conversionToBaseSnapshot: line.conversionToBaseSnapshot,
          isEstimatedWeight: line.isEstimatedWeight,
          ratePerKg: line.ratePerKg,
          unroundedGrams: line.unroundedGrams,
          roundedGrams: line.roundedGrams,
          roundingPolicyVersion: line.roundingPolicyVersion ?? (line.saleMode === "AMOUNT_EST" ? "v1_nearest_10g_half_up" : undefined),
          costSnapshot: line.costSnapshot,
          negotiatedPrice: line.negotiatedPrice,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          itemId: line.itemId,
          type: "SALE_OUT",
          deltaInBaseUnit: -line.qtyInBaseUnit,
          newQtyInBaseUnit: itemAfter.qtyInBaseUnit,
          referenceType: "sale_bill",
          referenceId: bill.id,
          referenceUuid: bill.uuid,
          reason: "Sale",
          costSnapshot: line.costSnapshot,
        },
      });
      if (itemAfter.qtyInBaseUnit <= itemAfter.lowStockThreshold) {
        await tx.appNotification.create({
          data: {
            type: "low_stock",
            message: `${itemAfter.name} is low on stock`,
            relatedItemId: itemAfter.id,
          },
        });
      }
      if (line.belowCost) {
        await tx.auditLog.create({
          data: {
            action: "below_cost_sale",
            entityType: "sale_line",
            entityId: createdLine.id,
            details: line.belowCostWarning ?? "Below-cost sale",
          },
        });
      }
    }

    if (payment.outstandingAmount > 0 && input.customerId) {
      await recordTransaction(tx, {
        partyType: "customer",
        partyId: input.customerId,
        transactionType: "credit_given",
        amount: payment.outstandingAmount,
        relatedSaleBillId: bill.id,
        note: "Sale outstanding balance",
      });
      await tx.customer.update({
        where: { id: input.customerId },
        data: { khataBalance: await getBalance("customer", input.customerId, tx) },
      });
    }
    await tx.auditLog.create({
      data: {
        action: "sale_created",
        entityType: "sale_bill",
        entityId: bill.id,
        details: JSON.stringify({ uuid: bill.uuid, total }),
      },
    });
    return tx.saleBill.findUniqueOrThrow({ where: { id: bill.id }, include: { lines: true } });
  });
