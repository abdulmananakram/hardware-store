import { calculateEstimatedWeightSale, calculateWeightedAverageCost, checkBelowCost, computeBalance, round2, toBase } from "./business";
import { localDb } from "./localDb";
import type {
  AdjustmentType, AuditLog, Customer, Item, KhataTransaction, ItemUnit, PaymentType,
  PurchaseBill, PurchaseBillLine, Return, SaleBill, SaleBillLine, StockAdjustment,
  Supplier, LocalPayment, SyncStatus,
} from "./types";

const tables = [
  localDb.settings, localDb.categories, localDb.items, localDb.customers, localDb.suppliers,
  localDb.saleBills, localDb.purchaseBills, localDb.returns, localDb.khataTransactions,
  localDb.notifications, localDb.rateHistory, localDb.aiSessions, localDb.stockAdjustments,
  localDb.categoryImages, localDb.inventoryMovements, localDb.auditLogs, localDb.attributes,
  localDb.attributeOptions, localDb.payments,
] as const;

const nextId = async (table: { toArray: () => Promise<Array<{ id?: number }>> }) => {
  const rows = await table.toArray();
  return rows.reduce((max, row) => Math.max(max, row.id ?? 0), 0) + 1;
};
const stamp = () => new Date().toISOString();
const payment = (total: number, type: PaymentType, paid?: number) => {
  const amountPaid = round2(paid ?? (type === "cash" ? total : 0));
  if (amountPaid < 0 || amountPaid > total) throw new Error("Payment cannot exceed the bill total");
  return { amountPaid, outstandingAmount: round2(total - amountPaid), paymentStatus: amountPaid === 0 ? "unpaid" : amountPaid === total ? "paid" : "partial" };
};
const txnsFor = (txns: KhataTransaction[], partyType: "customer" | "supplier", partyId: number) =>
  computeBalance(txns, partyType, partyId);
const audit = (id: number, action: string, details: string): AuditLog => ({ id, action, details, createdAt: stamp() });

export async function createLocalSale(input: {
  uuid: string; customerId?: number | null; paymentType: PaymentType; amountPaid?: number;
  lines: Array<{ itemId: number; unitId: number; qty: number; unitPrice?: number; saleMode?: "QTY" | "PACK" | "WEIGHT" | "AMOUNT_EST"; measuredWeight?: number; estimatedWeight?: { ratePerKg: number; saleAmount: number } }>;
}): Promise<SaleBill> {
  return localDb.transaction("rw", tables, async () => {
    const duplicate = await localDb.saleBills.where("uuid").equals(input.uuid).first();
    if (duplicate) return duplicate;
    if (!input.uuid || input.lines.length === 0) throw new Error("A sale UUID and at least one line are required");
    const saleId = await nextId(localDb.saleBills);
    const prepared: SaleBillLine[] = [];
    for (const line of input.lines) {
      const item = await localDb.items.get(line.itemId);
      if (!item || !item.isActive) throw new Error("Item is not available");
      const unit = item.units.find((candidate) => candidate.id === line.unitId);
      if (!unit || line.qty <= 0) throw new Error("Invalid sale unit or quantity");
      const mode = line.saleMode ?? (item.saleMode as "QTY" | "PACK" | "WEIGHT" | "AMOUNT_EST" | undefined) ?? "QTY";
      let qtyBase: number;
      let lineTotal: number;
      let grams: Partial<SaleBillLine> = {};
      if (mode === "AMOUNT_EST") {
        if (!line.estimatedWeight) throw new Error("Estimated sale requires amount and rate");
        const result = calculateEstimatedWeightSale(line.estimatedWeight.saleAmount, line.estimatedWeight.ratePerKg);
        qtyBase = item.baseUnitName.toLowerCase() === "kg" ? round2(result.roundedGrams / 1000) : result.roundedGrams;
        lineTotal = result.lineTotal;
        grams = { isEstimatedWeight: true, ratePerKg: line.estimatedWeight.ratePerKg, unroundedGrams: result.unroundedGrams, roundedGrams: result.roundedGrams };
      } else {
        if (mode === "WEIGHT" && (!line.measuredWeight || line.measuredWeight <= 0)) throw new Error("Measured weight is required");
        const quantity = mode === "WEIGHT" ? line.measuredWeight! : line.qty;
        if (mode === "PACK" && !item.fractionalPackAllowed && !Number.isInteger(quantity)) throw new Error("Fractional packs are disabled for this item");
        qtyBase = toBase(item, line.unitId, quantity);
        lineTotal = round2(quantity * (line.unitPrice ?? item.pricePerBaseUnit));
      }
      if (qtyBase <= 0) throw new Error("Sale quantity must be greater than zero");
      const below = checkBelowCost(line.estimatedWeight?.ratePerKg ?? line.unitPrice ?? item.pricePerBaseUnit, item.costPerBaseUnit);
      const current = item.qtyInBaseUnit - prepared.filter((p) => p.itemId === item.id).reduce((sum, p) => sum + p.qtyInBaseUnit, 0);
      if (qtyBase > current) throw new Error(`Insufficient stock for ${item.name}`);
      prepared.push({ id: 0, saleBillId: saleId, itemId: item.id, unitId: unit.id, qtyInSoldUnit: line.qty, qtyInBaseUnit: qtyBase, unitPriceAtSale: round2(line.estimatedWeight?.ratePerKg ?? line.unitPrice ?? item.pricePerBaseUnit), lineTotal, saleMode: mode, conversionToBaseSnapshot: unit.conversionToBase, costSnapshot: item.costPerBaseUnit, isBelowCost: below.isBelowCost, negotiatedPrice: line.unitPrice, createdAt: stamp(), ...grams });
    }
    let lineId = await nextId(localDb.auditLogs);
    prepared.forEach((line) => { line.id = lineId++; });
    const subtotal = round2(prepared.reduce((sum, line) => sum + line.lineTotal, 0));
    const config = (await localDb.settings.get("shopConfig"))?.value as { billRoundingEnabled?: boolean } | undefined;
    const total = config?.billRoundingEnabled === false ? subtotal : Math.round(subtotal);
    const pay = payment(total, input.paymentType, input.amountPaid);
    if (pay.outstandingAmount > 0 && !input.customerId) throw new Error("A customer is required for unpaid sales");
    const ts = stamp();
    const bill: SaleBill = { id: saleId, uuid: input.uuid, shopId: 1, customerId: input.customerId ?? null, billDate: ts, paymentType: input.paymentType, totalAmount: total, subtotalAmount: subtotal, roundingAdjustment: round2(total - subtotal), ...pay, syncStatus: "pending", createdAt: ts, updatedAt: ts, lines: prepared };
    const items = await localDb.items.bulkGet([...new Set(prepared.map((line) => line.itemId))]);
    for (const item of items) {
      if (!item) continue;
      const lines = prepared.filter((line) => line.itemId === item.id);
      const qty = lines.reduce((sum, line) => sum + line.qtyInBaseUnit, 0);
      const next = round2(item.qtyInBaseUnit - qty);
      await localDb.items.put({ ...item, qtyInBaseUnit: next, updatedAt: ts });
      await localDb.inventoryMovements.bulkAdd(lines.map((line) => ({ id: line.id, itemId: item.id, type: "SALE_OUT", deltaInBaseUnit: -line.qtyInBaseUnit, newQtyInBaseUnit: next, referenceType: "sale_bill" as const, referenceId: bill.id, referenceUuid: bill.uuid, note: line.isEstimatedWeight ? `Estimated ${line.roundedGrams}g` : "Sale", createdAt: ts })));
    }
    await localDb.saleBills.add(bill);
    const txns = await localDb.khataTransactions.toArray();
    if (pay.outstandingAmount > 0 && input.customerId) {
      const txn: KhataTransaction = { id: await nextId(localDb.khataTransactions), partyType: "customer", partyId: input.customerId, transactionType: "credit_given", amount: pay.outstandingAmount, relatedSaleBillId: bill.id, transactionDate: ts, createdAt: ts };
      await localDb.khataTransactions.add(txn);
      const customer = await localDb.customers.get(input.customerId);
      if (customer) await localDb.customers.put({ ...customer, khataBalance: txnsFor([...txns, txn], "customer", customer.id), updatedAt: ts });
    }
    await localDb.auditLogs.add(audit(await nextId(localDb.auditLogs), "sale_created", JSON.stringify({ uuid: bill.uuid, total, belowCost: prepared.some((line) => line.isBelowCost) })));
    return bill;
  });
}

export async function createLocalPurchase(input: {
  uuid: string; supplierId: number; paymentType: PaymentType; amountPaid?: number; discountAmount?: number; freightAmount?: number;
  lines: Array<{ itemId: number; unitId: number; qty: number; unitCost: number }>;
}): Promise<PurchaseBill> {
  return localDb.transaction("rw", tables, async () => {
    const duplicate = await localDb.purchaseBills.where("uuid").equals(input.uuid).first();
    if (duplicate) return duplicate;
    const supplier = await localDb.suppliers.get(input.supplierId);
    if (!supplier || input.lines.length === 0) throw new Error("Supplier and purchase lines are required");
    const billId = await nextId(localDb.purchaseBills);
    const prepared: PurchaseBillLine[] = [];
    for (const line of input.lines) {
      const item = await localDb.items.get(line.itemId);
      const unit = item?.units.find((candidate) => candidate.id === line.unitId);
      if (!item || !unit || line.qty <= 0 || line.unitCost < 0) throw new Error("Invalid purchase line");
      const qtyBase = toBase(item, unit.id, line.qty);
      prepared.push({ id: await nextId(localDb.rateHistory) + prepared.length, purchaseBillId: billId, itemId: item.id, unitId: unit.id, qtyInPurchasedUnit: line.qty, qtyInBaseUnit: qtyBase, unitCost: line.unitCost, costPerBaseUnit: round2(line.unitCost / unit.conversionToBase), lineTotal: round2(line.qty * line.unitCost), createdAt: stamp() });
    }
    const subtotal = round2(prepared.reduce((sum, line) => sum + line.lineTotal, 0));
    const total = round2(subtotal - (input.discountAmount ?? 0) + (input.freightAmount ?? 0));
    const pay = payment(total, input.paymentType, input.amountPaid);
    const ts = stamp();
    const bill: PurchaseBill = { id: billId, uuid: input.uuid, shopId: 1, supplierId: input.supplierId, billDate: ts, paymentType: input.paymentType, totalAmount: total, subtotalAmount: subtotal, ...pay, syncStatus: "pending", createdAt: ts, updatedAt: ts, lines: prepared };
    for (const line of prepared) {
      const item = await localDb.items.get(line.itemId);
      if (!item) throw new Error("Item disappeared during purchase");
      const landed = subtotal > 0 ? total / subtotal : 1;
      const cost = round2(line.costPerBaseUnit * landed);
      await localDb.items.put({ ...item, qtyInBaseUnit: round2(item.qtyInBaseUnit + line.qtyInBaseUnit), costPerBaseUnit: calculateWeightedAverageCost(item.qtyInBaseUnit, item.costPerBaseUnit ?? 0, line.qtyInBaseUnit, cost), updatedAt: ts });
      await localDb.inventoryMovements.add({ id: line.id, itemId: line.itemId, type: "PURCHASE_IN", deltaInBaseUnit: line.qtyInBaseUnit, newQtyInBaseUnit: round2(item.qtyInBaseUnit + line.qtyInBaseUnit), referenceType: "purchase_bill", referenceId: bill.id, referenceUuid: bill.uuid, costSnapshot: cost, note: "Purchase", createdAt: ts });
    }
    await localDb.purchaseBills.add(bill);
    if (pay.outstandingAmount > 0) await localDb.khataTransactions.add({ id: await nextId(localDb.khataTransactions), partyType: "supplier", partyId: input.supplierId, transactionType: "payable_incurred", amount: pay.outstandingAmount, relatedPurchaseBillId: bill.id, transactionDate: ts, createdAt: ts });
    await localDb.auditLogs.add(audit(await nextId(localDb.auditLogs), "purchase_created", JSON.stringify({ uuid: bill.uuid, total })));
    return bill;
  });
}

export async function createLocalStockAdjustment(input: { uuid: string; itemId: number; type: AdjustmentType; deltaInBaseUnit: number; reason: string; countedQtyInBaseUnit?: number }): Promise<StockAdjustment> {
  return localDb.transaction("rw", tables, async () => {
    const existing = await localDb.stockAdjustments.where("uuid").equals(input.uuid).first();
    if (existing) return existing;
    const item = await localDb.items.get(input.itemId);
    if (!item) throw new Error("Item not found");
    const system = item.qtyInBaseUnit;
    const delta = input.countedQtyInBaseUnit === undefined ? input.deltaInBaseUnit : round2(input.countedQtyInBaseUnit - system);
    const next = round2(system + delta);
    if (next < 0) throw new Error("Stock cannot become negative");
    const ts = stamp();
    const adjustment: StockAdjustment = { id: await nextId(localDb.stockAdjustments), uuid: input.uuid, itemId: item.id, type: input.type, deltaInBaseUnit: delta, newQtyInBaseUnit: next, systemQtyInBaseUnit: system, countedQtyInBaseUnit: input.countedQtyInBaseUnit, reason: input.reason, adjustedAt: ts };
    await localDb.stockAdjustments.add(adjustment);
    await localDb.items.put({ ...item, qtyInBaseUnit: next, updatedAt: ts });
    await localDb.inventoryMovements.add({ id: adjustment.id, itemId: item.id, type: delta >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", deltaInBaseUnit: delta, newQtyInBaseUnit: next, referenceType: "adjustment", referenceId: adjustment.id, referenceUuid: input.uuid, reason: input.reason, createdAt: ts });
    return adjustment;
  });
}

export async function recordLocalPayment(input: { uuid: string; partyType: "customer" | "supplier"; partyId: number; amount: number; method?: string; note?: string }): Promise<LocalPayment> {
  return localDb.transaction("rw", tables, async () => {
    const existing = await localDb.payments.where("uuid").equals(input.uuid).first();
    if (existing) return existing;
    if (input.amount <= 0) throw new Error("Payment amount must be greater than zero");
    const bills = input.partyType === "customer" ? await localDb.saleBills.where("customerId").equals(input.partyId).toArray() : await localDb.purchaseBills.where("supplierId").equals(input.partyId).toArray();
    let remaining = round2(input.amount);
    const allocations: LocalPayment["allocations"] = [];
    for (const bill of bills.filter((candidate) => !candidate.cancelled && (candidate.outstandingAmount ?? 0) > 0).sort((a, b) => a.id - b.id)) {
      if (remaining <= 0) break;
      const amount = round2(Math.min(remaining, bill.outstandingAmount ?? 0));
      allocations.push({ billId: bill.id, amount, billType: input.partyType === "customer" ? "sale" : "purchase" });
      remaining = round2(remaining - amount);
    }
    if (remaining !== 0) throw new Error("Payment exceeds outstanding balance; advances are not allowed");
    const ts = stamp();
    const paymentEntry: LocalPayment = { id: await nextId(localDb.payments), uuid: input.uuid, partyType: input.partyType, partyId: input.partyId, amount: input.amount, method: input.method ?? "cash", note: input.note, allocations, syncStatus: "pending", paymentDate: ts, createdAt: ts };
    await localDb.payments.add(paymentEntry);
    for (const allocation of allocations) {
      if (allocation.billType === "sale") {
        const bill = await localDb.saleBills.get(allocation.billId);
        if (bill) await localDb.saleBills.put({ ...bill, amountPaid: round2((bill.amountPaid ?? 0) + allocation.amount), outstandingAmount: round2((bill.outstandingAmount ?? 0) - allocation.amount), paymentStatus: round2((bill.outstandingAmount ?? 0) - allocation.amount) === 0 ? "paid" : "partial" });
      } else {
        const bill = await localDb.purchaseBills.get(allocation.billId);
        if (bill) await localDb.purchaseBills.put({ ...bill, amountPaid: round2((bill.amountPaid ?? 0) + allocation.amount), outstandingAmount: round2((bill.outstandingAmount ?? 0) - allocation.amount), paymentStatus: round2((bill.outstandingAmount ?? 0) - allocation.amount) === 0 ? "paid" : "partial" });
      }
    }
    await localDb.khataTransactions.add({ id: await nextId(localDb.khataTransactions), partyType: input.partyType, partyId: input.partyId, transactionType: input.partyType === "customer" ? "payment_received" : "payment_made", amount: input.amount, note: input.note, transactionDate: ts, createdAt: ts });
    return paymentEntry;
  });
}
