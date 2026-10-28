import "fake-indexeddb/auto";
import { localDb } from "../../lib/localDb";

describe("local database transactions", () => {
  beforeEach(async () => {
    await localDb.delete();
    await localDb.open();
  });

  afterAll(async () => {
    await localDb.delete();
  });

  test("rolls back all writes when a transaction fails", async () => {
    await expect(
      localDb.transaction("rw", localDb.items, async () => {
        await localDb.items.add({
          id: 1,
          shopId: 1,
          categoryId: 1,
          name: "Rollback item",
          icon: "📦",
          baseUnitName: "Piece",
          initialQtyInBaseUnit: 10,
          qtyInBaseUnit: 10,
          pricePerBaseUnit: 100,
          lowStockThreshold: 2,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          units: [],
        });
        throw new Error("simulated failure");
      })
    ).rejects.toThrow("simulated failure");

    await expect(localDb.items.get(1)).resolves.toBeUndefined();
  });
});
