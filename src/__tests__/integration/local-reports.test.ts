import "fake-indexeddb/auto";
import { localDb } from "../../lib/localDb";
import { getLocalReport } from "../../lib/localReports";

describe("offline reports", () => {
  beforeEach(async () => {
    await localDb.delete();
    await localDb.open();
    const now = new Date().toISOString();
    await localDb.saleBills.add({
      id: 1, uuid: "report-sale", shopId: 1, customerId: null, billDate: now, paymentType: "cash",
      totalAmount: 100, amountPaid: 100, outstandingAmount: 0, paymentStatus: "paid", syncStatus: "pending",
      createdAt: now, updatedAt: now,
      lines: [{ id: 1, saleBillId: 1, itemId: 1, unitId: 1, qtyInSoldUnit: 1, qtyInBaseUnit: 1, unitPriceAtSale: 100, lineTotal: 100, costSnapshot: 60, saleMode: "QTY", createdAt: now }],
    });
    await localDb.items.add({ id: 1, shopId: 1, categoryId: 1, name: "Item", icon: "📦", baseUnitName: "Piece", initialQtyInBaseUnit: 1, qtyInBaseUnit: 1, pricePerBaseUnit: 100, costPerBaseUnit: 60, lowStockThreshold: 2, isActive: true, createdAt: now, updatedAt: now, units: [] });
  });

  afterAll(() => localDb.delete());

  test("computes sales and gross profit without the network", async () => {
    const sales = await getLocalReport("sales");
    const profit = await getLocalReport("profit");
    expect(sales.total).toBe(100);
    expect(profit.grossProfit).toBe(40);
    expect(profit.estimated).toBe(false);
    expect(sales.note).toContain("Cancelled bills");
  });
});
