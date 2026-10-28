/**
 * ============================================================
 * UNIT TESTS — Pure Business Logic Helpers
 * File: src/__tests__/unit/business.test.ts
 * ============================================================
 */

import {
  round2,
  computeBalance,
  toBase,
  fmtRs,
  canDeleteCategory,
} from "../../lib/business";
import type { KhataTransaction, Item } from "../../lib/types";

// ─── Fixtures ────────────────────────────────────────────────

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  shopId: 1,
  categoryId: 10,
  name: "Steel Nail",
  icon: "📍",
  baseUnitName: "Piece",
  initialQtyInBaseUnit: 100,
  qtyInBaseUnit: 100,
  pricePerBaseUnit: 5,
  lowStockThreshold: 10,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  units: [
    {
      id: 101,
      itemId: 1,
      unitName: "Piece",
      conversionToBase: 1,
      isBaseUnit: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 102,
      itemId: 1,
      unitName: "Box",
      conversionToBase: 12,
      isBaseUnit: false,
      createdAt: new Date().toISOString(),
    },
  ],
  ...overrides,
});

const makeKhata = (overrides: Partial<KhataTransaction> = {}): KhataTransaction => ({
  id: 1,
  partyType: "customer",
  partyId: 1,
  transactionType: "credit_given",
  amount: 1000,
  transactionDate: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ─── round2 ─────────────────────────────────────────────────

describe("round2", () => {
  test("rounds to 2 decimal places", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(10.126)).toBe(10.13);
  });

  test("handles whole numbers", () => {
    expect(round2(100)).toBe(100);
    expect(round2(0)).toBe(0);
  });

  test("handles negative numbers", () => {
    expect(round2(-5.555)).toBe(-5.56);
  });
});

// ─── computeBalance ─────────────────────────────────────────

describe("computeBalance", () => {
  test("positive balance: customer owes shop after credit_given", () => {
    const txns: KhataTransaction[] = [
      makeKhata({ transactionType: "credit_given", amount: 1000 }),
    ];
    expect(computeBalance(txns, "customer", 1)).toBe(1000);
  });

  test("balance reduces after payment_received", () => {
    const txns: KhataTransaction[] = [
      makeKhata({ id: 1, transactionType: "credit_given", amount: 1000 }),
      makeKhata({ id: 2, transactionType: "payment_received", amount: 400 }),
    ];
    expect(computeBalance(txns, "customer", 1)).toBe(600);
  });

  test("negative balance when customer overpays (advance)", () => {
    const txns: KhataTransaction[] = [
      makeKhata({ id: 1, transactionType: "credit_given", amount: 500 }),
      makeKhata({ id: 2, transactionType: "payment_received", amount: 700 }),
    ];
    expect(computeBalance(txns, "customer", 1)).toBe(-200);
  });

  test("zero balance when fully paid", () => {
    const txns: KhataTransaction[] = [
      makeKhata({ id: 1, transactionType: "credit_given", amount: 300 }),
      makeKhata({ id: 2, transactionType: "payment_received", amount: 300 }),
    ];
    expect(computeBalance(txns, "customer", 1)).toBe(0);
  });

  test("ignores transactions for other parties", () => {
    const txns: KhataTransaction[] = [
      makeKhata({ id: 1, partyId: 1, transactionType: "credit_given", amount: 1000 }),
      makeKhata({ id: 2, partyId: 2, transactionType: "credit_given", amount: 9999 }),
    ];
    expect(computeBalance(txns, "customer", 1)).toBe(1000);
  });

  test("ignores transactions for different partyType", () => {
    const txns: KhataTransaction[] = [
      makeKhata({ id: 1, partyType: "supplier", partyId: 1, transactionType: "payable_incurred", amount: 500 }),
    ];
    expect(computeBalance(txns, "customer", 1)).toBe(0);
  });

  test("supplier balance: payable_incurred adds, payment_made subtracts", () => {
    const txns: KhataTransaction[] = [
      makeKhata({ id: 1, partyType: "supplier", partyId: 5, transactionType: "payable_incurred", amount: 2000 }),
      makeKhata({ id: 2, partyType: "supplier", partyId: 5, transactionType: "payment_made", amount: 800 }),
    ];
    expect(computeBalance(txns, "supplier", 5)).toBe(1200);
  });

  test("empty transactions returns 0", () => {
    expect(computeBalance([], "customer", 1)).toBe(0);
  });
});

// ─── toBase ──────────────────────────────────────────────────

describe("toBase", () => {
  const item = makeItem();

  test("base unit: 1 Piece = 1 base", () => {
    expect(toBase(item, 101, 1)).toBe(1);
  });

  test("base unit: 5 Pieces = 5 base", () => {
    expect(toBase(item, 101, 5)).toBe(5);
  });

  test("box unit: 1 Box = 12 base", () => {
    expect(toBase(item, 102, 1)).toBe(12);
  });

  test("box unit: 3 Boxes = 36 base", () => {
    expect(toBase(item, 102, 3)).toBe(36);
  });

  test("unknown unitId: returns qty as-is", () => {
    expect(toBase(item, 999, 7)).toBe(7);
  });

  test("fractional qty: 0.5 Box = 6 base", () => {
    expect(toBase(item, 102, 0.5)).toBe(6);
  });
});

// ─── fmtRs ───────────────────────────────────────────────────

describe("fmtRs", () => {
  test("formats whole numbers", () => {
    expect(fmtRs(1000)).toBe("Rs. 1,000");
  });

  test("rounds decimals", () => {
    expect(fmtRs(1234.7)).toBe("Rs. 1,235");
    expect(fmtRs(999.4)).toBe("Rs. 999");
  });

  test("formats zero", () => {
    expect(fmtRs(0)).toBe("Rs. 0");
  });
});

// ─── canDeleteCategory ───────────────────────────────────────

describe("canDeleteCategory", () => {
  test("allows deleting category with no items", () => {
    const result = canDeleteCategory([], 10);
    expect(result.ok).toBe(true);
  });

  test("blocks deleting category that has active items", () => {
    const item = makeItem({ categoryId: 10, isActive: true });
    const result = canDeleteCategory([item], 10);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("allows deleting category when items are inactive (soft-deleted)", () => {
    const item = makeItem({ categoryId: 10, isActive: false });
    const result = canDeleteCategory([item], 10);
    expect(result.ok).toBe(true);
  });

  test("allows deleting category when items belong to different category", () => {
    const item = makeItem({ categoryId: 99, isActive: true });
    const result = canDeleteCategory([item], 10);
    expect(result.ok).toBe(true);
  });
});
