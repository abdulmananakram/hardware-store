import { reconcileQuantities } from "../../server/services/inventoryService";

describe("inventory ledger reconciliation", () => {
  test("reconciles opening, purchase, sale, return and adjustment movements", () => {
    expect(reconcileQuantities(95, [100, 50, -60, 10, -5])).toEqual({
      ledgerQty: 95,
      difference: 0,
      reconciled: true,
    });
  });

  test("reports a cached-balance mismatch", () => {
    expect(reconcileQuantities(96, [100, -5])).toEqual({
      ledgerQty: 95,
      difference: 1,
      reconciled: false,
    });
  });
});
