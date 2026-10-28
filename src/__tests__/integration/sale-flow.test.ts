/**
 * ============================================================
 * INTEGRATION TESTS — Sale Flow
 * Tests the complete sale lifecycle:
 *   add to cart → stock validation → commit → stock deduction → khata
 * File: src/__tests__/integration/sale-flow.test.ts
 * ============================================================
 */

import { computeBalance, toBase, round2 } from "../../lib/business";
import type {
  Item,
  SaleBill,
  KhataTransaction,
  Customer,
  PaymentType,
} from "../../lib/types";

// ─── Minimal in-memory state (mirrors the Zustand store) ────

interface MockState {
  items: Item[];
  saleBills: SaleBill[];
  khataTransactions: KhataTransaction[];
  customers: Customer[];
  draftLines: { itemId: number; unitId: number; qty: number; lineTotal: number }[];
}

function makeItem(
  id: number,
  qty: number,
  price: number,
  categoryId = 10
): Item {
  return {
    id,
    shopId: 1,
    categoryId,
    name: `Item-${id}`,
    icon: "📦",
    baseUnitName: "Piece",
    initialQtyInBaseUnit: qty,
    qtyInBaseUnit: qty,
    pricePerBaseUnit: price,
    lowStockThreshold: 5,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    units: [
      {
        id: id * 100 + 1,
        itemId: id,
        unitName: "Piece",
        conversionToBase: 1,
        isBaseUnit: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: id * 100 + 2,
        itemId: id,
        unitName: "Box",
        conversionToBase: 12,
        isBaseUnit: false,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function makeCustomer(id: number, balance = 0): Customer {
  return {
    id,
    shopId: 1,
    name: `Customer-${id}`,
    khataBalance: balance,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Simulate draftSaleAddLine validation */
function addToCart(
  state: MockState,
  itemId: number,
  unitId: number,
  qty: number
): { ok: boolean; error?: string } {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Item not found" };
  if (!qty || qty <= 0) return { ok: false, error: "Enter valid quantity" };

  const qtyBase = toBase(item, unitId, qty);
  const inCartBase = state.draftLines
    .filter((l) => l.itemId === itemId)
    .reduce((sum, l) => sum + toBase(item, l.unitId, l.qty), 0);

  const totalRequested = round2(inCartBase + qtyBase);
  if (totalRequested > item.qtyInBaseUnit) {
    return { ok: false, error: `Not enough stock (${item.qtyInBaseUnit} available)` };
  }

  const lineTotal = round2(qtyBase * item.pricePerBaseUnit);
  state.draftLines.push({ itemId, unitId, qty, lineTotal });
  return { ok: true };
}

/** Simulate commitSale */
function commitSale(
  state: MockState,
  customerId: number | null,
  paymentType: PaymentType
): SaleBill {
  const now = new Date().toISOString();
  const total = round2(state.draftLines.reduce((s, l) => s + l.lineTotal, 0));
  const billId = Date.now();

  const lines = state.draftLines.map((l, idx) => {
    const item = state.items.find((i) => i.id === l.itemId)!;
    const qtyBase = toBase(item, l.unitId, l.qty);
    return {
      id: billId + idx + 1,
      saleBillId: billId,
      itemId: l.itemId,
      unitId: l.unitId,
      qtyInSoldUnit: l.qty,
      qtyInBaseUnit: qtyBase,
      unitPriceAtSale: item.pricePerBaseUnit,
      lineTotal: l.lineTotal,
      createdAt: now,
    };
  });

  const bill: SaleBill = {
    id: billId,
    uuid: "test-uuid-" + billId,
    shopId: 1,
    customerId,
    billDate: now,
    paymentType,
    totalAmount: total,
    syncStatus: "pending",
    createdAt: now,
    updatedAt: now,
    lines,
  };

  // Deduct stock
  for (const line of lines) {
    const item = state.items.find((i) => i.id === line.itemId)!;
    item.qtyInBaseUnit = round2(item.qtyInBaseUnit - line.qtyInBaseUnit);
  }

  // Khata entry for udhaar
  if (paymentType === "udhaar" && customerId) {
    const txn: KhataTransaction = {
      id: billId + 1000,
      partyType: "customer",
      partyId: customerId,
      transactionType: "credit_given",
      amount: total,
      relatedSaleBillId: bill.id,
      transactionDate: now,
      createdAt: now,
    };
    state.khataTransactions.push(txn);
    // Update customer balance
    const cust = state.customers.find((c) => c.id === customerId);
    if (cust) {
      cust.khataBalance = computeBalance(state.khataTransactions, "customer", customerId);
    }
  }

  state.saleBills.push(bill);
  state.draftLines = [];
  return bill;
}

// ─── Tests ───────────────────────────────────────────────────

describe("Sale Flow — Integration", () => {
  let state: MockState;

  beforeEach(() => {
    state = {
      items: [
        makeItem(1, 100, 10),   // 100 pieces @ Rs10 each
        makeItem(2, 50, 25),    // 50 pieces @ Rs25 each
      ],
      customers: [makeCustomer(1)],
      saleBills: [],
      khataTransactions: [],
      draftLines: [],
    };
  });

  // --- Cart Validation ---

  test("adds item to cart successfully", () => {
    const result = addToCart(state, 1, 101, 5);
    expect(result.ok).toBe(true);
    expect(state.draftLines).toHaveLength(1);
  });

  test("blocks adding zero quantity", () => {
    const result = addToCart(state, 1, 101, 0);
    expect(result.ok).toBe(false);
  });

  test("blocks adding negative quantity", () => {
    const result = addToCart(state, 1, 101, -3);
    expect(result.ok).toBe(false);
  });

  test("blocks adding more than available stock", () => {
    const result = addToCart(state, 1, 101, 101); // only 100 in stock
    expect(result.ok).toBe(false);
    expect(result.error).toContain("100");
  });

  test("blocks adding item from non-existent id", () => {
    const result = addToCart(state, 999, 101, 5);
    expect(result.ok).toBe(false);
  });

  test("cart considers existing lines when validating stock", () => {
    addToCart(state, 1, 101, 80);  // 80 in cart
    const result = addToCart(state, 1, 101, 25); // 80+25=105 > 100
    expect(result.ok).toBe(false);
  });

  test("allows adding up to exact stock amount", () => {
    const result = addToCart(state, 1, 101, 100); // exactly 100
    expect(result.ok).toBe(true);
  });

  test("box unit: 1 box = 12 pieces deducted from cart check", () => {
    // Item 1 has 100 pieces. 1 Box = 12 pieces
    const result = addToCart(state, 1, 102, 8); // 8 boxes = 96 pieces
    expect(result.ok).toBe(true);
  });

  test("box unit: over-limit is blocked", () => {
    addToCart(state, 1, 102, 8); // 96 pieces in cart
    const result = addToCart(state, 1, 102, 1); // +12 = 108 > 100
    expect(result.ok).toBe(false);
  });

  // --- Commit Sale (Cash) ---

  test("cash sale: stock is deducted after commit", () => {
    addToCart(state, 1, 101, 10);
    commitSale(state, null, "cash");
    expect(state.items[0].qtyInBaseUnit).toBe(90);
  });

  test("cash sale: bill is added to saleBills", () => {
    addToCart(state, 1, 101, 5);
    const bill = commitSale(state, null, "cash");
    expect(state.saleBills).toHaveLength(1);
    expect(bill.paymentType).toBe("cash");
    expect(bill.totalAmount).toBe(50); // 5 × Rs10
  });

  test("cash sale: no khata entry created", () => {
    addToCart(state, 1, 101, 5);
    commitSale(state, 1, "cash");
    expect(state.khataTransactions).toHaveLength(0);
  });

  test("cash sale: draft is cleared after commit", () => {
    addToCart(state, 1, 101, 5);
    commitSale(state, null, "cash");
    expect(state.draftLines).toHaveLength(0);
  });

  // --- Commit Sale (Udhaar) ---

  test("udhaar sale: khata entry is created", () => {
    addToCart(state, 1, 101, 10);
    commitSale(state, 1, "udhaar");
    expect(state.khataTransactions).toHaveLength(1);
    expect(state.khataTransactions[0].transactionType).toBe("credit_given");
    expect(state.khataTransactions[0].amount).toBe(100); // 10 × Rs10
  });

  test("udhaar sale: customer balance increases", () => {
    addToCart(state, 1, 101, 10);
    commitSale(state, 1, "udhaar");
    expect(state.customers[0].khataBalance).toBe(100);
  });

  test("udhaar sale: customer balance accumulates across multiple sales", () => {
    addToCart(state, 1, 101, 10);
    commitSale(state, 1, "udhaar"); // Rs100
    addToCart(state, 2, 201, 4);
    commitSale(state, 1, "udhaar"); // 4 × Rs25 = Rs100
    expect(state.customers[0].khataBalance).toBe(200);
  });

  // --- Multi-item Sale ---

  test("multi-item sale: correct total", () => {
    addToCart(state, 1, 101, 3); // 3 × 10 = 30
    addToCart(state, 2, 201, 2); // 2 × 25 = 50
    const bill = commitSale(state, null, "cash");
    expect(bill.totalAmount).toBe(80);
  });

  test("multi-item sale: all items deducted", () => {
    addToCart(state, 1, 101, 5);
    addToCart(state, 2, 201, 10);
    commitSale(state, null, "cash");
    expect(state.items[0].qtyInBaseUnit).toBe(95);
    expect(state.items[1].qtyInBaseUnit).toBe(40);
  });
});
