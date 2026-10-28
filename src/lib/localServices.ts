import { calculateEstimatedWeightSale, calculateWeightedAverageCost, checkBelowCost, computeBalance, round2, toBase } from "./business";
import { localDb } from "./localDb";
import type {
  AdjustmentType, AuditLog, Category, Customer, Item, KhataTransaction, ItemUnit, PaymentType,
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

export async function createLocalCategory(input: {
  uuid: string; name: string; urduName?: string; icon?: string; parentCategoryId?: number | null; date?: string; isDemo?: boolean;
}): Promise<Category> {
  return localDb.transaction("rw", tables, async () => {
    const existing = (await localDb.categories.toArray()).find((category) => category.isDemo && category.name === input.name);
    if (existing) return existing;
    const ts = input.date ?? stamp();
    const category: Category = {
      id: await nextId(localDb.categories), shopId: 1, name: input.name, urduName: input.urduName,
      icon: input.icon ?? "📦", parentCategoryId: input.parentCategoryId ?? null, createdAt: ts, updatedAt: ts, isDemo: input.isDemo,
    };
    await localDb.categories.add(category);
    await localDb.auditLogs.add({ ...audit(await nextId(localDb.auditLogs), "category_created", input.uuid), createdAt: ts, isDemo: input.isDemo });
    return category;
  });
}

export async function createLocalItem(input: {
  uuid: string; categoryId: number; name: string; urduName?: string; skuCode?: string; baseUnitName: string;
  saleMode: "QTY" | "PACK" | "WEIGHT" | "AMOUNT_EST"; conversionUnits?: { name: string; conversionToBase: number }[];
  costPerBaseUnit: number; pricePerBaseUnit: number; openingQty: number; lowStockThreshold: number;
  fractionalPackAllowed?: boolean; date?: string; isDemo?: boolean;
}): Promise<Item> {
  return localDb.transaction("rw", tables, async () => {
    const existing = (await localDb.items.toArray()).find((item) => item.isDemo && item.skuCode === input.skuCode);
    if (existing) return existing;
    if (!(await localDb.categories.get(input.categoryId))) throw new Error("Category not found");
    if (input.openingQty < 0) throw new Error("Opening stock cannot be negative");
    const ts = input.date ?? stamp();
    const id = await nextId(localDb.items);
    const units: ItemUnit[] = [
      { id: id * 1000 + 1, itemId: id, unitName: input.baseUnitName, conversionToBase: 1, isBaseUnit: true, createdAt: ts },
      ...(input.conversionUnits ?? []).map((unit, index) => ({
        id: id * 1000 + index + 2, itemId: id, unitName: unit.name, conversionToBase: unit.conversionToBase, isBaseUnit: false, createdAt: ts,
      })),
    ];
    const item: Item = {
      id, shopId: 1, categoryId: input.categoryId, name: input.name, urduName: input.urduName, skuCode: input.skuCode,
      icon: "📦", baseUnitName: input.baseUnitName, initialQtyInBaseUnit: input.openingQty, qtyInBaseUnit: input.openingQty,
      pricePerBaseUnit: input.pricePerBaseUnit, costPerBaseUnit: input.costPerBaseUnit, lowStockThreshold: input.lowStockThreshold,
      saleMode: input.saleMode, fractionalPackAllowed: input.fractionalPackAllowed ?? false, isActive: true,
      createdAt: ts, updatedAt: ts, units, isDemo: input.isDemo,
    };
    await localDb.items.add(item);
    await localDb.inventoryMovements.add({
      id: await nextId(localDb.inventoryMovements), itemId: id, type: "OPENING", deltaInBaseUnit: input.openingQty,
      newQtyInBaseUnit: input.openingQty, referenceType: "opening", referenceId: id, referenceUuid: input.uuid,
      reason: "Opening stock", costSnapshot: input.costPerBaseUnit, createdAt: ts, isDemo: input.isDemo,
    });
    await localDb.auditLogs.add({ ...audit(await nextId(localDb.auditLogs), "item_created", input.uuid), createdAt: ts, isDemo: input.isDemo });
    return item;
  });
}

export async function createLocalCustomer(input: { uuid: string; name: string; phone?: string; notes?: string; date?: string; isDemo?: boolean }): Promise<Customer> {
  return localDb.transaction("rw", tables, async () => {
    const existing = (await localDb.customers.toArray()).find((customer) => customer.isDemo && customer.phone === input.phone);
    if (existing) return existing;
    const ts = input.date ?? stamp();
    const customer: Customer = { id: await nextId(localDb.customers), shopId: 1, name: input.name, phone: input.phone, notes: input.notes, khataBalance: 0, createdAt: ts, updatedAt: ts, isDemo: input.isDemo };
    await localDb.customers.add(customer);
    return customer;
  });
}

export async function createLocalSupplier(input: { uuid: string; name: string; phone?: string; notes?: string; date?: string; isDemo?: boolean }): Promise<Supplier> {
  return localDb.transaction("rw", tables, async () => {
    const existing = (await localDb.suppliers.toArray()).find((supplier) => supplier.isDemo && supplier.phone === input.phone);
    if (existing) return existing;
    const ts = input.date ?? stamp();
    const supplier: Supplier = { id: await nextId(localDb.suppliers), shopId: 1, name: input.name, phone: input.phone, notes: input.notes, payableBalance: 0, createdAt: ts, updatedAt: ts, isDemo: input.isDemo };
    await localDb.suppliers.add(supplier);
    return supplier;
  });
}

export async function cancelLocalSale(input: { uuid: string; saleBillId: number; reason: string; date?: string; isDemo?: boolean }): Promise<SaleBill> {
  return localDb.transaction("rw", tables, async () => {
    const already = await localDb.auditLogs.toArray();
    if (already.some((entry) => entry.action === "sale_cancelled" && entry.details.includes(input.uuid))) {
      const bill = await localDb.saleBills.get(input.saleBillId);
      if (bill) return bill;
    }
    const bill = await localDb.saleBills.get(input.saleBillId);
    if (!bill) throw new Error("Sale bill not found");
    if (bill.cancelled) throw new Error("Sale is already cancelled");
    const ts = input.date ?? stamp();
    for (const line of bill.lines) {
      const item = await localDb.items.get(line.itemId);
      if (!item) throw new Error("Sale item not found");
      const next = round2(item.qtyInBaseUnit + line.qtyInBaseUnit);
      await localDb.items.put({ ...item, qtyInBaseUnit: next, updatedAt: ts });
      await localDb.inventoryMovements.add({
        id: await nextId(localDb.inventoryMovements), itemId: item.id, type: "REVERSAL",
        deltaInBaseUnit: line.qtyInBaseUnit, newQtyInBaseUnit: next, referenceType: "sale_cancellation",
        referenceId: bill.id, referenceUuid: input.uuid, reason: input.reason, costSnapshot: line.costSnapshot, createdAt: ts, isDemo: input.isDemo,
      });
    }
    const updated = { ...bill, cancelled: true, cancelReason: input.reason, updatedAt: ts, isDemo: input.isDemo ?? bill.isDemo };
    await localDb.saleBills.put(updated);
    if (bill.customerId && (bill.outstandingAmount ?? 0) > 0) {
      await localDb.khataTransactions.add({
        id: await nextId(localDb.khataTransactions), partyType: "customer", partyId: bill.customerId,
        transactionType: "customer_return_credit", amount: bill.outstandingAmount ?? 0, relatedSaleBillId: bill.id,
        note: `Sale cancelled: ${input.reason}`, transactionDate: ts, createdAt: ts, isDemo: input.isDemo,
      });
    }
    await localDb.auditLogs.add({ ...audit(await nextId(localDb.auditLogs), "sale_cancelled", `${input.uuid}:${input.reason}`), createdAt: ts, isDemo: input.isDemo });
    return updated;
  });
}

export async function createLocalSale(input: {
  uuid: string; customerId?: number | null; paymentType: PaymentType; amountPaid?: number;
  date?: string; isDemo?: boolean;
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
      const mode = line.saleMode ?? (item.saleMode as "QTY" | "PACK" | "WEIGHT" | "AMOUNT_EST" | undefined) ?? "QTY";
      if (!unit || (line.qty <= 0 && mode !== "AMOUNT_EST")) throw new Error("Invalid sale unit or quantity");
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
    const ts = input.date ?? stamp();
    const bill: SaleBill = { id: saleId, uuid: input.uuid, shopId: 1, customerId: input.customerId ?? null, billDate: ts, paymentType: input.paymentType, totalAmount: total, subtotalAmount: subtotal, roundingAdjustment: round2(total - subtotal), ...pay, syncStatus: "pending", createdAt: ts, updatedAt: ts, lines: prepared, isDemo: input.isDemo };
    const items = await localDb.items.bulkGet([...new Set(prepared.map((line) => line.itemId))]);
    for (const item of items) {
      if (!item) continue;
      const lines = prepared.filter((line) => line.itemId === item.id);
      const qty = lines.reduce((sum, line) => sum + line.qtyInBaseUnit, 0);
      const next = round2(item.qtyInBaseUnit - qty);
      await localDb.items.put({ ...item, qtyInBaseUnit: next, updatedAt: ts });
      for (const line of lines) await localDb.inventoryMovements.add({ id: await nextId(localDb.inventoryMovements), itemId: item.id, type: "SALE_OUT", deltaInBaseUnit: -line.qtyInBaseUnit, newQtyInBaseUnit: next, referenceType: "sale_bill", referenceId: bill.id, referenceUuid: bill.uuid, note: line.isEstimatedWeight ? `Estimated ${line.roundedGrams}g` : "Sale", createdAt: ts, isDemo: input.isDemo });
    }
    await localDb.saleBills.add(bill);
    const txns = await localDb.khataTransactions.toArray();
    if (pay.outstandingAmount > 0 && input.customerId) {
      const txn: KhataTransaction = { id: await nextId(localDb.khataTransactions), partyType: "customer", partyId: input.customerId, transactionType: "credit_given", amount: pay.outstandingAmount, relatedSaleBillId: bill.id, transactionDate: ts, createdAt: ts, isDemo: input.isDemo };
      await localDb.khataTransactions.add(txn);
      const customer = await localDb.customers.get(input.customerId);
      if (customer) await localDb.customers.put({ ...customer, khataBalance: txnsFor([...txns, txn], "customer", customer.id), updatedAt: ts });
    }
    await localDb.auditLogs.add({ ...audit(await nextId(localDb.auditLogs), "sale_created", JSON.stringify({ uuid: bill.uuid, total, belowCost: prepared.some((line) => line.isBelowCost) })), isDemo: input.isDemo });
    return bill;
  });
}

export async function createLocalPurchase(input: {
  uuid: string; supplierId: number; paymentType: PaymentType; amountPaid?: number; discountAmount?: number; freightAmount?: number;
  date?: string; isDemo?: boolean;
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
    const ts = input.date ?? stamp();
    const bill: PurchaseBill = { id: billId, uuid: input.uuid, shopId: 1, supplierId: input.supplierId, billDate: ts, paymentType: input.paymentType, totalAmount: total, subtotalAmount: subtotal, ...pay, syncStatus: "pending", createdAt: ts, updatedAt: ts, lines: prepared, isDemo: input.isDemo };
    for (const line of prepared) {
      const item = await localDb.items.get(line.itemId);
      if (!item) throw new Error("Item disappeared during purchase");
      const landed = subtotal > 0 ? total / subtotal : 1;
      const cost = round2(line.costPerBaseUnit * landed);
      await localDb.items.put({ ...item, qtyInBaseUnit: round2(item.qtyInBaseUnit + line.qtyInBaseUnit), costPerBaseUnit: calculateWeightedAverageCost(item.qtyInBaseUnit, item.costPerBaseUnit ?? 0, line.qtyInBaseUnit, cost), updatedAt: ts });
      await localDb.inventoryMovements.add({ id: await nextId(localDb.inventoryMovements), itemId: line.itemId, type: "PURCHASE_IN", deltaInBaseUnit: line.qtyInBaseUnit, newQtyInBaseUnit: round2(item.qtyInBaseUnit + line.qtyInBaseUnit), referenceType: "purchase_bill", referenceId: bill.id, referenceUuid: bill.uuid, costSnapshot: cost, note: "Purchase", createdAt: ts, isDemo: input.isDemo });
    }
    await localDb.purchaseBills.add(bill);
    if (pay.outstandingAmount > 0) {
      const transaction: KhataTransaction = { id: await nextId(localDb.khataTransactions), partyType: "supplier", partyId: input.supplierId, transactionType: "payable_incurred", amount: pay.outstandingAmount, relatedPurchaseBillId: bill.id, transactionDate: ts, createdAt: ts, isDemo: input.isDemo };
      await localDb.khataTransactions.add(transaction);
      const updatedSupplier = await localDb.suppliers.get(input.supplierId);
      if (updatedSupplier) await localDb.suppliers.put({ ...updatedSupplier, payableBalance: txnsFor(await localDb.khataTransactions.toArray(), "supplier", input.supplierId), updatedAt: ts });
    }
    await localDb.auditLogs.add({ ...audit(await nextId(localDb.auditLogs), "purchase_created", JSON.stringify({ uuid: bill.uuid, total })), isDemo: input.isDemo });
    return bill;
  });
}

export async function createLocalStockAdjustment(input: { uuid: string; itemId: number; type: AdjustmentType; deltaInBaseUnit: number; reason: string; countedQtyInBaseUnit?: number; date?: string; isDemo?: boolean }): Promise<StockAdjustment> {
  return localDb.transaction("rw", tables, async () => {
    const existing = await localDb.stockAdjustments.where("uuid").equals(input.uuid).first();
    if (existing) return existing;
    const item = await localDb.items.get(input.itemId);
    if (!item) throw new Error("Item not found");
    const system = item.qtyInBaseUnit;
    const delta = input.countedQtyInBaseUnit === undefined ? input.deltaInBaseUnit : round2(input.countedQtyInBaseUnit - system);
    const next = round2(system + delta);
    if (next < 0) throw new Error("Stock cannot become negative");
    const ts = input.date ?? stamp();
    const adjustment: StockAdjustment = { id: await nextId(localDb.stockAdjustments), uuid: input.uuid, itemId: item.id, type: input.type, deltaInBaseUnit: delta, newQtyInBaseUnit: next, systemQtyInBaseUnit: system, countedQtyInBaseUnit: input.countedQtyInBaseUnit, reason: input.reason, adjustedAt: ts, isDemo: input.isDemo };
    await localDb.stockAdjustments.add(adjustment);
    await localDb.items.put({ ...item, qtyInBaseUnit: next, updatedAt: ts });
    await localDb.inventoryMovements.add({ id: await nextId(localDb.inventoryMovements), itemId: item.id, type: delta >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", deltaInBaseUnit: delta, newQtyInBaseUnit: next, referenceType: "adjustment", referenceId: adjustment.id, referenceUuid: input.uuid, reason: input.reason, createdAt: ts, isDemo: input.isDemo });
    return adjustment;
  });
}

export async function recordLocalPayment(input: { uuid: string; partyType: "customer" | "supplier"; partyId: number; amount: number; method?: string; note?: string; date?: string; isDemo?: boolean }): Promise<LocalPayment> {
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
    const ts = input.date ?? stamp();
    const paymentEntry: LocalPayment = { id: await nextId(localDb.payments), uuid: input.uuid, partyType: input.partyType, partyId: input.partyId, amount: input.amount, method: input.method ?? "cash", note: input.note, allocations, syncStatus: "pending", paymentDate: ts, createdAt: ts, isDemo: input.isDemo };
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
    const transaction: KhataTransaction = { id: await nextId(localDb.khataTransactions), partyType: input.partyType, partyId: input.partyId, transactionType: input.partyType === "customer" ? "payment_received" : "payment_made", amount: input.amount, note: input.note, transactionDate: ts, createdAt: ts, isDemo: input.isDemo };
    await localDb.khataTransactions.add(transaction);
    const transactions = await localDb.khataTransactions.toArray();
    if (input.partyType === "customer") {
      const customer = await localDb.customers.get(input.partyId);
      if (customer) await localDb.customers.put({ ...customer, khataBalance: txnsFor(transactions, "customer", input.partyId), updatedAt: ts });
    } else {
      const supplier = await localDb.suppliers.get(input.partyId);
      if (supplier) await localDb.suppliers.put({ ...supplier, payableBalance: txnsFor(transactions, "supplier", input.partyId), updatedAt: ts });
    }
    return paymentEntry;
  });
}

export async function createLocalCustomerReturn(input: { uuid: string; saleBillLineId: number; qtyReturnedInBaseUnit: number; reason: string; disposition: "back_to_sellable_stock" | "damaged_pile"; date?: string; isDemo?: boolean }): Promise<Return> {
  return localDb.transaction("rw", tables, async () => {
    const duplicate = await localDb.returns.where("uuid").equals(input.uuid).first();
    if (duplicate) return duplicate;
    const sales = await localDb.saleBills.toArray();
    const line = sales.flatMap((bill) => bill.lines).find((candidate) => candidate.id === input.saleBillLineId);
    if (!line || input.qtyReturnedInBaseUnit <= 0) throw new Error("Sale line not found");
    const prior = (await localDb.returns.toArray()).filter((entry) => entry.saleBillLineId === line.id).reduce((sum, entry) => sum + entry.qtyReturnedInBaseUnit, 0);
    if (input.qtyReturnedInBaseUnit > round2(line.qtyInBaseUnit - prior)) throw new Error("Return quantity exceeds the unreturned quantity");
    const ts = input.date ?? stamp();
    const entry: Return = { id: await nextId(localDb.returns), uuid: input.uuid, saleBillLineId: line.id, qtyReturnedInBaseUnit: input.qtyReturnedInBaseUnit, reason: input.reason as Return["reason"], disposition: input.disposition, refundAmount: round2(input.qtyReturnedInBaseUnit / line.qtyInBaseUnit * line.lineTotal), returnDate: ts, createdAt: ts, updatedAt: ts, isDemo: input.isDemo };
    await localDb.returns.add(entry);
    if (input.disposition === "back_to_sellable_stock") {
      const item = await localDb.items.get(line.itemId);
      if (item) {
        const next = round2(item.qtyInBaseUnit + input.qtyReturnedInBaseUnit);
        await localDb.items.put({ ...item, qtyInBaseUnit: next, updatedAt: ts });
        await localDb.inventoryMovements.add({ id: await nextId(localDb.inventoryMovements), itemId: item.id, type: "CUSTOMER_RETURN_IN", deltaInBaseUnit: input.qtyReturnedInBaseUnit, newQtyInBaseUnit: next, referenceType: "return", referenceId: entry.id, referenceUuid: input.uuid, reason: input.reason, costSnapshot: line.costSnapshot, createdAt: ts, isDemo: input.isDemo });
      }
    }
    const bill = sales.find((candidate) => candidate.lines.some((candidateLine) => candidateLine.id === line.id));
    if (bill?.customerId) {
      await localDb.khataTransactions.add({ id: await nextId(localDb.khataTransactions), partyType: "customer", partyId: bill.customerId, transactionType: "customer_return_credit", amount: entry.refundAmount, relatedReturnId: entry.id, note: "Customer return credit", transactionDate: ts, createdAt: ts, isDemo: input.isDemo });
      const customer = await localDb.customers.get(bill.customerId);
      if (customer) await localDb.customers.put({ ...customer, khataBalance: txnsFor(await localDb.khataTransactions.toArray(), "customer", bill.customerId), updatedAt: ts });
    }
    return entry;
  });
}

export async function createLocalSupplierReturn(input: { uuid: string; purchaseBillLineId: number; qtyReturnedInBaseUnit: number; reason: string; date?: string; isDemo?: boolean }): Promise<Return> {
  return localDb.transaction("rw", tables, async () => {
    const duplicate = await localDb.returns.where("uuid").equals(input.uuid).first();
    if (duplicate) return duplicate;
    const purchases = await localDb.purchaseBills.toArray();
    const line = purchases.flatMap((bill) => bill.lines).find((candidate) => candidate.id === input.purchaseBillLineId);
    if (!line || input.qtyReturnedInBaseUnit <= 0) throw new Error("Purchase line not found");
    const prior = (await localDb.returns.toArray()).filter((entry) => entry.purchaseBillLineId === line.id).reduce((sum, entry) => sum + entry.qtyReturnedInBaseUnit, 0);
    if (input.qtyReturnedInBaseUnit > round2(line.qtyInBaseUnit - prior)) throw new Error("Return quantity exceeds the unreturned quantity");
    const item = await localDb.items.get(line.itemId);
    if (!item || item.qtyInBaseUnit < input.qtyReturnedInBaseUnit) throw new Error("Insufficient stock for supplier return");
    const ts = input.date ?? stamp();
    const entry: Return = { id: await nextId(localDb.returns), uuid: input.uuid, purchaseBillLineId: line.id, qtyReturnedInBaseUnit: input.qtyReturnedInBaseUnit, reason: input.reason as Return["reason"], disposition: "damaged_pile", refundAmount: round2(input.qtyReturnedInBaseUnit / line.qtyInBaseUnit * line.lineTotal), returnDate: ts, createdAt: ts, updatedAt: ts, isDemo: input.isDemo };
    await localDb.returns.add(entry);
    const next = round2(item.qtyInBaseUnit - input.qtyReturnedInBaseUnit);
    await localDb.items.put({ ...item, qtyInBaseUnit: next, updatedAt: ts });
    await localDb.inventoryMovements.add({ id: await nextId(localDb.inventoryMovements), itemId: item.id, type: "SUPPLIER_RETURN_OUT", deltaInBaseUnit: -input.qtyReturnedInBaseUnit, newQtyInBaseUnit: next, referenceType: "supplier_return", referenceId: entry.id, referenceUuid: input.uuid, reason: input.reason, costSnapshot: line.costPerBaseUnit, createdAt: ts, isDemo: input.isDemo });
    const bill = purchases.find((candidate) => candidate.lines.some((candidateLine) => candidateLine.id === line.id));
    if (bill) {
      await localDb.khataTransactions.add({ id: await nextId(localDb.khataTransactions), partyType: "supplier", partyId: bill.supplierId, transactionType: "supplier_return_credit", amount: entry.refundAmount, relatedReturnId: entry.id, note: "Supplier return credit", transactionDate: ts, createdAt: ts, isDemo: input.isDemo });
      const supplier = await localDb.suppliers.get(bill.supplierId);
      if (supplier) await localDb.suppliers.put({ ...supplier, payableBalance: txnsFor(await localDb.khataTransactions.toArray(), "supplier", bill.supplierId), updatedAt: ts });
    }
    return entry;
  });
}
