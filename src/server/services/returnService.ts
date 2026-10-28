import { db } from "@/lib/db";
import { round2 } from "@/lib/business";
import { getBalance, recordTransaction } from "./khataService";
import { ServiceError } from "./shared";

export const createCustomerReturn = async (input: {
  saleBillLineId: number;
  qtyReturnedInBaseUnit: number;
  reason: string;
  disposition: "back_to_sellable_stock" | "damaged_pile";
}) => db.$transaction(async (tx) => {
  if (input.qtyReturnedInBaseUnit <= 0) throw new ServiceError("Return quantity must be positive");
  const line = await tx.saleBillLine.findUnique({ where: { id: input.saleBillLineId }, include: { saleBill: true, returns: true } });
  if (!line || line.saleBill.cancelled) throw new ServiceError("Sale line not found", 404);
  const returned = line.returns.reduce((sum, item) => sum + item.qtyReturnedInBaseUnit, 0);
  if (input.qtyReturnedInBaseUnit > round2(line.qtyInBaseUnit - returned)) throw new ServiceError("Return quantity exceeds the unreturned quantity");
  const refundAmount = round2((input.qtyReturnedInBaseUnit / line.qtyInBaseUnit) * line.lineTotal);
  const entry = await tx.return.create({ data: { saleBillLineId: line.id, qtyReturnedInBaseUnit: input.qtyReturnedInBaseUnit, reason: input.reason, disposition: input.disposition, refundAmount } });
  if (input.disposition === "back_to_sellable_stock") {
    const item = await tx.item.update({ where: { id: line.itemId }, data: { qtyInBaseUnit: { increment: input.qtyReturnedInBaseUnit } } });
    await tx.inventoryMovement.create({ data: { itemId: line.itemId, type: "CUSTOMER_RETURN_IN", deltaInBaseUnit: input.qtyReturnedInBaseUnit, newQtyInBaseUnit: item.qtyInBaseUnit, referenceType: "return", referenceId: entry.id, reason: input.reason, costSnapshot: line.costSnapshot } });
  }
  if (line.saleBill.customerId) {
    await recordTransaction(tx, { partyType: "customer", partyId: line.saleBill.customerId, transactionType: "customer_return_credit", amount: refundAmount, relatedReturnId: entry.id, note: "Customer return credit" });
    await tx.customer.update({ where: { id: line.saleBill.customerId }, data: { khataBalance: await getBalance("customer", line.saleBill.customerId, tx) } });
  }
  await tx.auditLog.create({ data: { action: "customer_return", entityType: "return", entityId: entry.id, details: JSON.stringify(input) } });
  return entry;
});

export const createSupplierReturn = async (input: {
  purchaseBillLineId: number;
  qtyReturnedInBaseUnit: number;
  reason: string;
}) => db.$transaction(async (tx) => {
  if (input.qtyReturnedInBaseUnit <= 0) throw new ServiceError("Return quantity must be positive");
  const line = await tx.purchaseBillLine.findUnique({ where: { id: input.purchaseBillLineId }, include: { purchaseBill: true, returns: true } });
  if (!line || line.purchaseBill.cancelled) throw new ServiceError("Purchase line not found", 404);
  const returned = line.returns.reduce((sum, item) => sum + item.qtyReturnedInBaseUnit, 0);
  if (input.qtyReturnedInBaseUnit > round2(line.qtyInBaseUnit - returned)) throw new ServiceError("Return quantity exceeds the unreturned quantity");
  const refundAmount = round2((input.qtyReturnedInBaseUnit / line.qtyInBaseUnit) * line.lineTotal);
  const entry = await tx.return.create({ data: { purchaseBillLineId: line.id, qtyReturnedInBaseUnit: input.qtyReturnedInBaseUnit, reason: input.reason, disposition: "supplier_return", refundAmount } });
  const item = await tx.item.update({ where: { id: line.itemId }, data: { qtyInBaseUnit: { decrement: input.qtyReturnedInBaseUnit } } });
  if (item.qtyInBaseUnit < 0) throw new ServiceError("Insufficient stock for supplier return");
  await tx.inventoryMovement.create({ data: { itemId: line.itemId, type: "SUPPLIER_RETURN_OUT", deltaInBaseUnit: -input.qtyReturnedInBaseUnit, newQtyInBaseUnit: item.qtyInBaseUnit, referenceType: "supplier_return", referenceId: entry.id, reason: input.reason, costSnapshot: line.costPerBaseUnit } });
  await recordTransaction(tx, { partyType: "supplier", partyId: line.purchaseBill.supplierId, transactionType: "supplier_return_credit", amount: refundAmount, relatedReturnId: entry.id, note: "Supplier return credit" });
  await tx.auditLog.create({ data: { action: "supplier_return", entityType: "return", entityId: entry.id, details: JSON.stringify(input) } });
  return entry;
});
