import "fake-indexeddb/auto";
import { exportLocalDatabase, getBackupStatus, importLocalDatabase, localDb } from "../../lib/localDb";

describe("Dexie backup and restore", () => {
  beforeEach(async () => {
    await localDb.delete();
    await localDb.open();
    await localDb.settings.put({ key: "shopConfig", value: { shopId: 1, shopName: "Test" } });
  });
  afterAll(() => localDb.delete());

  test("exports and restores existing data with confirmation and sync ids", async () => {
    await localDb.items.add({ id: 9, shopId: 1, categoryId: 1, name: "Saved", icon: "📦", baseUnitName: "Piece", initialQtyInBaseUnit: 1, qtyInBaseUnit: 1, pricePerBaseUnit: 2, lowStockThreshold: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), units: [] });
    const backup = await exportLocalDatabase();
    expect((await getBackupStatus()).due).toBe(false);
    await localDb.items.clear();
    await expect(importLocalDatabase(backup)).rejects.toThrow("confirmation");
    await importLocalDatabase(backup, true);
    expect((await localDb.items.get(9))?.name).toBe("Saved");
  });
});
