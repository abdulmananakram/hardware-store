import { db } from "@/lib/db";
import { round2 } from "@/lib/business";
import { getBalance, recordTransaction } from "./khataService";
import { ServiceError, type DbClient } from "./shared";

export const createCustomerReturn = async (input: {
  saleBillLineId: number;
  qtyReturnedInBaseUnit: number;
  reason: string;
  disposition: "back_to_sellable_stock" | "damaged_pile";
}) =>
  db.$transaction(async (tx) => {
    if (input.qtyReturnedInBaseUnit <= 0) throw new ServiceError("Return quantity must be positive");
    const line = await tx.saleBillLine.findUnique({
      where: { id: input.saleBillLineId },
      include: { saleBill: true, returns: true },
    });
    if (!line || line.saleBill.cancelled) throw new ServiceError("Sale line not found", 404);
    const returned = line.returns.reduce((sum, item) => sum + item.qtyReturnedInBaseUnit, 0);
    const remaining = round2(line.qtyInBaseUnit - returned);
    if (input.qtyReturnedInBaseUnit > remaining) {
      throw new ServiceError("Return quantity exceeds the unreturned quantity");
    }
    const refundAmount = round2(
      (input.qtyReturnedInBaseUnit / line.qtyInBaseUnit) * line.lineTotal
    );
    const entry = await tx.return.create({
      data: {
        saleBillLineId: line.id,
        qtyReturnedInBaseUnit: input.qtyReturnedInBaseUnit,
        reason: input.reason,
        disposition: input.disposition,
        refundAmount,
      },
    });
    if (input.disposition === "back_to_sellable_stock") {
      const item = await tx.item.update({
        where: { id: line.itemId },
        data: { qtyInBaseUnit: { increment: input.qtyReturnedInBaseUnit } },
      });
      await tx.inventoryMovement.create({
        data: {
          itemId: line.itemId,
          type: "customer_return",
          deltaInBaseUnit: input.qtyReturnedInBaseUnit,
          newQtyInBaseUnit: item.qtyInBaseUnit,
          referenceType: "return",
          referenceId: entry.id,
          reason: input.reason,
        },
      });
    }
    if (line.saleBill.customerId) {
      await recordTransaction(tx, {
        partyType: "customer",
        partyId: line.saleBill.customerId,
        transactionType: "payment_received",
        amount: refundAmount,
        relatedReturnId: entry.id,
        note: "Customer return credit",
      });
      await tx.customer.update({
        where: { id: line.saleBill.customerId },
        data: {
          khataBalance: await getBalance("customer", line.saleBill.customerId, tx),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        action: "customer_return",
        entityType: "return",
        entityId: entry.id,
        details: JSON.stringify(input),
      },
    });
    return entry;
  });

