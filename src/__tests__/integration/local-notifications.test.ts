import "fake-indexeddb/auto";
import { localDb } from "../../lib/localDb";
import { generateLocalNotifications } from "../../lib/localNotifications";

describe("local notifications", () => {
  beforeEach(async () => {
    await localDb.delete();
    await localDb.open();
    const now = new Date(Date.now() - 10 * 86400000).toISOString();
    await localDb.settings.put({ key: "shopConfig", value: { khataReminderThresholdAmount: 100, khataReminderThresholdDays: 7 } });
    await localDb.items.add({ id: 1, shopId: 1, categoryId: 1, name: "Low item", icon: "📦", baseUnitName: "Piece", initialQtyInBaseUnit: 1, qtyInBaseUnit: 1, pricePerBaseUnit: 10, lowStockThreshold: 2, isActive: true, createdAt: now, updatedAt: now, units: [] });
    await localDb.customers.add({ id: 1, shopId: 1, name: "Customer", khataBalance: 150, createdAt: now, updatedAt: now });
    await localDb.saleBills.add({ id: 1, uuid: "old-bill", shopId: 1, customerId: 1, billDate: now, paymentType: "udhaar", totalAmount: 150, outstandingAmount: 150, syncStatus: "pending", createdAt: now, updatedAt: now, lines: [] });
  });
  afterAll(() => localDb.delete());
  test("creates low-stock and Udhaar reminders locally", async () => {
    expect(await generateLocalNotifications()).toBe(2);
    expect(await localDb.notifications.count()).toBe(2);
    expect(await generateLocalNotifications()).toBe(0);
  });
});
