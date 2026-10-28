/**
 * ============================================================
 * INTEGRATION TESTS — Return & Cancel Flow
 * Tests:
 *   - Return: partial qty → stock restore → refund amount
 *   - Cancel: with prior returns → only restore unreturned qty
 * File: src/__tests__/integration/return-cancel.test.ts
 * ============================================================
 */

import { round2, toBase, computeBalance } from "../../lib/business";
import type {
  Item,
  SaleBill,
  SaleBillLine,
  Return,
  KhataTransaction,
  Customer,
  ReturnReason,
  ReturnDisposition,
} from "../../lib/types";

// ─── Helpers ─────────────────────────────────────────────────

function makeItem(id: number, qty: number, price: number): Item {
  return {
    id,
    shopId: 1,
    categoryId: 10,
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
    ],
  };
}

function makeBill(
  id: number,
  customerId: number | null,
  lines: SaleBillLine[]
): SaleBill {
  const now = new Date().toISOString();
  const total = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  return {
    id,
    uuid: `uuid-${id}`,
    shopId: 1,
    customerId,
    billDate: now,
    paymentType: "udhaar",
    totalAmount: total,
    syncStatus: "pending",
    createdAt: now,
    updatedAt: now,
    lines,
  };
}

function makeLine(
  id: number,
  billId: number,
  item: Item,
  qty: number
): SaleBillLine {
  return {
    id,
    saleBillId: billId,
    itemId: item.id,
    unitId: item.units[0].id,
    qtyInSoldUnit: qty,
    qtyInBaseUnit: qty,
    unitPriceAtSale: item.pricePerBaseUnit,
    lineTotal: round2(qty * item.pricePerBaseUnit),
    createdAt: new Date().toISOString(),
  };
}

interface MockState {
  items: Item[];
  saleBills: SaleBill[];
  returns: Return[];
  khataTransactions: KhataTransaction[];
  customers: Customer[];
}

/** Simulate recordReturn */
function recordReturn(
  state: MockState,
  line: SaleBillLine,
  qtyReturned: number,
  reason: ReturnReason,
  disposition: ReturnDisposition
): { ok: boolean; error?: string } {
  const alreadyReturned = state.returns
    .filter((r) => r.saleBillLineId === line.id)
    .reduce((s, r) => s + r.qtyReturnedInBaseUnit, 0);

  const maxReturnable = line.qtyInBaseUnit - alreadyReturned;
  if (qtyReturned > maxReturnable) {
    return { ok: false, error: `Max returnable: ${maxReturnable}` };
  }
  if (qtyReturned <= 0) {
    return { ok: false, error: "Return qty must be > 0" };
  }

  const refundAmount = round2(
    (qtyReturned / line.qtyInBaseUnit) * line.lineTotal
  );

  const ret: Return = {
    id: Date.now(),
    saleBillLineId: line.id,
    qtyReturnedInBaseUnit: qtyReturned,
    reason,
    disposition,
    refundAmount,
    returnDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.returns.push(ret);

  if (disposition === "back_to_sellable_stock") {
    const item = state.items.find((i) => i.id === line.itemId)!;
    item.qtyInBaseUnit = round2(item.qtyInBaseUnit + qtyReturned);
  }

  const bill = state.saleBills.find((b) => b.id === line.saleBillId);
  if (bill && bill.paymentType === "udhaar" && bill.customerId) {
    state.khataTransactions.push({
      id: Date.now() + 500,
      partyType: "customer",
      partyId: bill.customerId,
      transactionType: "payment_received",
      amount: refundAmount,
      relatedReturnId: ret.id,
      transactionDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    const cust = state.customers.find((c) => c.id === bill.customerId);
    if (cust) {
      cust.khataBalance = computeBalance(state.khataTransactions, "customer", cust.id);
    }
  }

  return { ok: true };
}

/** Simulate cancelSaleBill */
function cancelSaleBill(
  state: MockState,
  billId: number,
  reason: string
): { ok: boolean; error?: string } {
  const bill = state.saleBills.find((b) => b.id === billId);
  if (!bill) return { ok: false, error: "Bill not found" };
  if (bill.cancelled) return { ok: false, error: "Already cancelled" };

  // Restore only unreturned stock
  for (const line of bill.lines) {
    const alreadyReturned = state.returns
      .filter((r) => r.saleBillLineId === line.id)
      .reduce((s, r) => s + r.qtyReturnedInBaseUnit, 0);
    const unreturnedQty = line.qtyInBaseUnit - alreadyReturned;
    if (unreturnedQty > 0) {
      const item = state.items.find((i) => i.id === line.itemId)!;
      item.qtyInBaseUnit = round2(item.qtyInBaseUnit + unreturnedQty);
    }
  }

  // Reverse net remaining khata
  if (bill.paymentType === "udhaar" && bill.customerId) {
    const totalRefunded = state.returns
      .filter((r) => bill.lines.some((l) => l.id === r.saleBillLineId))
      .reduce((s, r) => s + r.refundAmount, 0);
    const netRemaining = round2(bill.totalAmount - totalRefunded);
    if (netRemaining > 0) {
      const now = new Date().toISOString();
      state.khataTransactions.push({
        id: Date.now() + 9999,
        partyType: "customer",
        partyId: bill.customerId,
        transactionType: "payment_received",
        amount: netRemaining,
        relatedSaleBillId: bill.id,
        transactionDate: now,
        createdAt: now,
      });
      const cust = state.customers.find((c) => c.id === bill.customerId);
      if (cust) {
        cust.khataBalance = computeBalance(
          state.khataTransactions,
          "customer",
          cust.id
        );
      }
    }
  }

  bill.cancelled = true;
  bill.cancelReason = reason;
  return { ok: true };
}

// ─── Test Data Setup ─────────────────────────────────────────

function makeState(): MockState {
  const item = makeItem(1, 50, 20); // 50 pieces @ Rs20
  item.qtyInBaseUnit = 30; // after sale of 20 (20 sold, 30 remaining)

  const line = makeLine(101, 1, item, 20); // sold 20 pieces
  const bill = makeBill(1, 1, [line]);
  bill.paymentType = "udhaar";

  const khataCredit: KhataTransaction = {
    id: 999,
    partyType: "customer",
    partyId: 1,
    transactionType: "credit_given",
    amount: 400, // 20 × Rs20
    relatedSaleBillId: 1,
    transactionDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  return {
    items: [item],
    saleBills: [bill],
    returns: [],
    khataTransactions: [khataCredit],
    customers: [
      {
        id: 1,
        shopId: 1,
        name: "Ahmed",
        khataBalance: 400,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

// ─── Return Tests ─────────────────────────────────────────────

describe("Return Flow — Integration", () => {
  let state: MockState;
  let bill: SaleBill;
  let line: SaleBillLine;

  beforeEach(() => {
    state = makeState();
    bill = state.saleBills[0];
    line = bill.lines[0];
  });

  test("partial return: restores stock when disposition is back_to_sellable", () => {
    recordReturn(state, line, 5, "damaged", "back_to_sellable_stock");
    expect(state.items[0].qtyInBaseUnit).toBe(35); // 30 + 5
  });

  test("partial return: does NOT restore stock when damaged_pile", () => {
    recordReturn(state, line, 5, "damaged", "damaged_pile");
    expect(state.items[0].qtyInBaseUnit).toBe(30); // unchanged
  });

  test("partial return: calculates correct refund (pro-rated)", () => {
    recordReturn(state, line, 10, "no_longer_needed", "back_to_sellable_stock");
    // 10/20 × Rs400 = Rs200
    expect(state.returns[0].refundAmount).toBe(200);
  });

  test("full return: refund equals line total", () => {
    recordReturn(state, line, 20, "no_longer_needed", "back_to_sellable_stock");
    expect(state.returns[0].refundAmount).toBe(400);
  });

  test("blocks return of more than sold quantity", () => {
    const result = recordReturn(state, line, 25, "damaged", "damaged_pile");
    expect(result.ok).toBe(false);
  });

  test("blocks double return exceeding sold qty", () => {
    recordReturn(state, line, 15, "damaged", "back_to_sellable_stock");
    const result = recordReturn(state, line, 10, "damaged", "back_to_sellable_stock");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("5"); // only 5 left returnable
  });

  test("blocks return of 0 qty", () => {
    const result = recordReturn(state, line, 0, "other", "damaged_pile");
    expect(result.ok).toBe(false);
  });

  test("two partial returns within limit are allowed", () => {
    const r1 = recordReturn(state, line, 8, "no_longer_needed", "back_to_sellable_stock");
    const r2 = recordReturn(state, line, 10, "wrong_item", "back_to_sellable_stock");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(state.returns).toHaveLength(2);
  });
});

// ─── Cancel Tests ─────────────────────────────────────────────

describe("Cancel Flow — Integration", () => {
  let state: MockState;
  let bill: SaleBill;
  let line: SaleBillLine;

  beforeEach(() => {
    state = makeState();
    bill = state.saleBills[0];
    line = bill.lines[0];
  });

  test("cancel without prior returns: fully restores stock", () => {
    cancelSaleBill(state, bill.id, "Mistake");
    expect(state.items[0].qtyInBaseUnit).toBe(50); // 30 + 20
  });

  test("cancel without prior returns: fully reverses khata", () => {
    cancelSaleBill(state, bill.id, "Mistake");
    expect(state.customers[0].khataBalance).toBe(0);
  });

  test("cancel after partial return: only restores unreturned qty", () => {
    recordReturn(state, line, 5, "damaged", "back_to_sellable_stock"); // returned 5
    // stock is now 30+5=35
    cancelSaleBill(state, bill.id, "Cancelled");
    // only 15 unreturned should be restored: 35 + 15 = 50
    expect(state.items[0].qtyInBaseUnit).toBe(50);
  });

  test("cancel after partial return: reverses only net remaining khata", () => {
    recordReturn(state, line, 10, "no_longer_needed", "back_to_sellable_stock"); // refund Rs200
    cancelSaleBill(state, bill.id, "Cancelled");
    // Net remaining = Rs400 - Rs200 = Rs200 reversed → balance = Rs400 - Rs200 = 0
    expect(state.customers[0].khataBalance).toBe(0);
  });

  test("cancel after full return: does not create khata reversal (nothing to reverse)", () => {
    recordReturn(state, line, 20, "no_longer_needed", "back_to_sellable_stock");
    const khataCountBefore = state.khataTransactions.length;
    cancelSaleBill(state, bill.id, "Cancelled");
    // Net remaining = 0 → no new khata entry needed
    expect(state.khataTransactions.length).toBe(khataCountBefore);
  });

  test("cancel marks bill as cancelled", () => {
    cancelSaleBill(state, bill.id, "Test reason");
    expect(state.saleBills[0].cancelled).toBe(true);
    expect(state.saleBills[0].cancelReason).toBe("Test reason");
  });

  test("cannot cancel an already cancelled bill", () => {
    cancelSaleBill(state, bill.id, "First");
    const result = cancelSaleBill(state, bill.id, "Second");
    expect(result.ok).toBe(false);
  });

  test("cannot cancel non-existent bill", () => {
    const result = cancelSaleBill(state, 9999, "oops");
    expect(result.ok).toBe(false);
  });
});
