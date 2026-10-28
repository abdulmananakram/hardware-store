import "fake-indexeddb/auto";
import { localDb } from "../../lib/localDb";
import { createLocalPurchase, createLocalSale, createLocalStockAdjustment, createLocalSupplierReturn, recordLocalPayment } from "../../lib/localServices";

const item = {
  id: 1, shopId: 1, categoryId: 1, name: "Nail", icon: "📦", baseUnitName: "Piece",
  initialQtyInBaseUnit: 10, qtyInBaseUnit: 10, pricePerBaseUnit: 10, costPerBaseUnit: 5,
  lowStockThreshold: 2, saleMode: "QTY", isActive: true, createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(), units: [{ id: 1, itemId: 1, unitName: "Piece", conversionToBase: 1, isBaseUnit: true, createdAt: new Date().toISOString() }],
};

describe("offline domain services", () => {
  beforeEach(async () => {
    await localDb.delete();
    await localDb.open();
    await localDb.settings.put({ key: "shopConfig", value: { billRoundingEnabled: true } });
    await localDb.items.add(item);
    await localDb.suppliers.add({ id: 1, shopId: 1, name: "Supplier", payableBalance: 0, createdAt: item.createdAt, updatedAt: item.updatedAt });
  });

  afterAll(() => localDb.delete());

  test("sale is atomic and idempotent", async () => {
    const first = await createLocalSale({ uuid: "sale-1", paymentType: "cash", lines: [{ itemId: 1, unitId: 1, qty: 2 }] });
    const duplicate = await createLocalSale({ uuid: "sale-1", paymentType: "cash", lines: [{ itemId: 1, unitId: 1, qty: 9 }] });
    expect(duplicate.id).toBe(first.id);
    expect((await localDb.items.get(1))?.qtyInBaseUnit).toBe(8);
    await expect(createLocalSale({ uuid: "sale-2", paymentType: "cash", lines: [{ itemId: 1, unitId: 1, qty: 99 }] })).rejects.toThrow("Insufficient stock");
    expect(await localDb.saleBills.count()).toBe(1);
  });

  test("purchase updates weighted average and payment allocates", async () => {
    const purchase = await createLocalPurchase({ uuid: "purchase-1", supplierId: 1, paymentType: "udhaar", lines: [{ itemId: 1, unitId: 1, qty: 2, unitCost: 10 }] });
    expect(purchase.outstandingAmount).toBe(20);
    const updated = await localDb.items.get(1);
    expect(updated?.costPerBaseUnit).toBeCloseTo(5.83, 1);
    const received = await recordLocalPayment({ uuid: "payment-1", partyType: "supplier", partyId: 1, amount: 10 });
    expect(received.allocations).toHaveLength(1);
    expect((await localDb.purchaseBills.get(purchase.id))?.outstandingAmount).toBe(10);
  });

  test("physical count writes an adjustment and ledger movement", async () => {
    const adjustment = await createLocalStockAdjustment({ uuid: "adjust-1", itemId: 1, type: "correction", deltaInBaseUnit: 0, countedQtyInBaseUnit: 7, reason: "Counted shelf" });
    expect(adjustment.systemQtyInBaseUnit).toBe(10);
    expect(adjustment.deltaInBaseUnit).toBe(-3);
    expect(await localDb.inventoryMovements.count()).toBe(1);
  });

  test("supplier return uses a distinct credit transaction", async () => {
    const purchase = await createLocalPurchase({ uuid: "purchase-return", supplierId: 1, paymentType: "udhaar", lines: [{ itemId: 1, unitId: 1, qty: 2, unitCost: 10 }] });
    await createLocalSupplierReturn({ uuid: "return-1", purchaseBillLineId: purchase.lines[0].id, qtyReturnedInBaseUnit: 1, reason: "Wrong item" });
    const transactions = await localDb.khataTransactions.toArray();
    expect(transactions.at(-1)?.transactionType).toBe("supplier_return_credit");
    expect(transactions.at(-1)?.amount).toBe(10);
  });
});
