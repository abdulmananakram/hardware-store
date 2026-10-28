import { db } from "@/lib/db";
import { getBalance, recordTransaction } from "./khataService";
import { ServiceError } from "./shared";

export const cancelSale = async (id: number, reason: string) =>
  db.$transaction(async (tx) => {
    const bill = await tx.saleBill.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!bill) throw new ServiceError("Sale bill not found", 404);
    if (bill.cancelled) throw new ServiceError("Sale bill is already cancelled");
    for (const line of bill.lines) {
      const item = await tx.item.update({
        where: { id: line.itemId },
        data: { qtyInBaseUnit: { increment: line.qtyInBaseUnit } },
      });
      await tx.inventoryMovement.create({
        data: {
          itemId: line.itemId,
          type: "cancellation",
          deltaInBaseUnit: line.qtyInBaseUnit,
          newQtyInBaseUnit: item.qtyInBaseUnit,
          referenceType: "sale_bill",
          referenceId: bill.id,
          referenceUuid: bill.uuid,
          reason,
        },
      });
    }
    if (bill.customerId && bill.outstandingAmount > 0) {
      await recordTransaction(tx, {
        partyType: "customer",
        partyId: bill.customerId,
        transactionType: "payment_received",
        amount: bill.outstandingAmount,
        relatedSaleBillId: bill.id,
        note: `Sale cancellation: ${reason}`,
      });
      await tx.customer.update({
        where: { id: bill.customerId },
        data: { khataBalance: await getBalance("customer", bill.customerId, tx) },
      });
    }
    const updated = await tx.saleBill.update({
      where: { id },
      data: { cancelled: true, cancelReason: reason },
      include: { lines: true },
    });
    await tx.auditLog.create({
      data: {
        action: "cancellation",
        entityType: "sale_bill",
        entityId: id,
        details: JSON.stringify({ reason }),
        reason,
      },
    });
    return updated;
  });

