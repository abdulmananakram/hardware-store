import "fake-indexeddb/auto";
import { localDb } from "../../lib/localDb";
import { assertDemoExpected, seedDemoData } from "../../lib/demoSeed";
import { getLocalReport } from "../../lib/localReports";

describe("offline reports", () => {
  beforeEach(async () => {
    await localDb.delete();
    await localDb.open();
    await seedDemoData();
    await assertDemoExpected();
  });

  afterAll(() => localDb.delete());

  test("computes the sample sales and gross profit without the network", async () => {
    const sales = await getLocalReport("sales");
    const profit = await getLocalReport("profit");
    expect(sales.total).toBe(4215);
    expect(sales.cancellations).toHaveLength(1);
    expect(profit.estimated).toBe(true);
    expect(sales.note).toContain("Cancelled bills");
  });

  test("reports stock and separate receivables/payables from the sample ledger", async () => {
    const stock = await getLocalReport("stock");
    const udhaar = await getLocalReport("udhaar");
    if (!stock.items || !udhaar.customers || !udhaar.suppliers) throw new Error("Unexpected report shape");
    expect(stock.items.find((item) => item.skuCode === "N-WD-2")?.qtyInBaseUnit).toBe(39490);
    expect(udhaar.customers.find((customer) => customer.name === "Haji Shafi")?.khataBalance).toBe(240);
    expect(udhaar.suppliers.find((supplier) => supplier.name === "Lahore Fasteners Traders")?.payableBalance).toBe(6000);
  });
});
