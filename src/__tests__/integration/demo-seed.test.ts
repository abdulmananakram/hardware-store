import "fake-indexeddb/auto";
import { localDb } from "../../lib/localDb";
import { assertDemoExpected, seedDemoData } from "../../lib/demoSeed";
import { createLocalSale, recordLocalPayment } from "../../lib/localServices";
import { getLocalReport } from "../../lib/localReports";

describe("demo dataset", () => {
  beforeEach(async () => {
    await localDb.delete();
    await localDb.open();
  });

  afterAll(() => localDb.delete());

  test("seeds through local services and matches the sample expected results", async () => {
    const seeded = await seedDemoData();
    await assertDemoExpected();
    expect(seeded.items.size).toBe(41);
    expect((await localDb.inventoryMovements.toArray()).filter((movement) => movement.type === "OPENING")).toHaveLength(41);
    expect((await localDb.items.toArray()).every((item) => item.isDemo)).toBe(true);
    expect((await localDb.saleBills.toArray()).every((bill) => bill.isDemo)).toBe(true);

    const sales = await getLocalReport("sales");
    expect(sales.total).toBe(4215);
    expect(sales.cancellations).toHaveLength(1);
    const profit = await getLocalReport("profit");
    expect(profit.estimated).toBe(true);
  });

  test("rejects blocked demo attempts without storing them", async () => {
    const { items, customerId } = await seedDemoData();
    const spring = items.get("H-SPR-3")!;
    await expect(createLocalSale({
      uuid: "blocked-stock", paymentType: "cash",
      lines: [{ itemId: spring.id, unitId: spring.units[0].id, qty: 1 }],
    })).rejects.toThrow("Insufficient stock");
    await expect(recordLocalPayment({ uuid: "blocked-payment", partyType: "customer", partyId: customerId, amount: 5000 })).rejects.toThrow("advances");
    await expect(createLocalSale({
      uuid: "blocked-rate", paymentType: "cash",
      lines: [{ itemId: items.get("N-WD-2")!.id, unitId: items.get("N-WD-2")!.units[0].id, qty: 0, saleMode: "AMOUNT_EST", estimatedWeight: { saleAmount: 100, ratePerKg: 0 } }],
    })).rejects.toThrow("Rate per kg");
    expect(await localDb.saleBills.where("uuid").equals("blocked-stock").count()).toBe(0);
    expect(await localDb.payments.where("uuid").equals("blocked-payment").count()).toBe(0);
  });
});
