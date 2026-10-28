/**
 * ============================================================
 * INTEGRATION TESTS — Purchase Flow
 * Tests: purchase → stock increase → supplier payable → cost update
 * File: src/__tests__/integration/purchase-flow.test.ts
 * ============================================================
 */

import { round2, toBase, computeBalance } from "../../lib/business";
import type {
  Item,
  PurchaseBill,
  PurchaseBillLine,
  KhataTransaction,
  Supplier,
  PaymentType,
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
      {
        id: id * 100 + 2,
        itemId: id,
        unitName: "Box",
        conversionToBase: 10,
        isBaseUnit: false,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function makeSupplier(id: number, balance = 0): Supplier {
  return {
    id,
    shopId: 1,
    name: `Supplier-${id}`,
    payableBalance: balance,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface MockState {
  items: Item[];
  purchaseBills: PurchaseBill[];
  khataTransactions: KhataTransaction[];
  suppliers: Supplier[];
  draftLines: {
    itemId: number;
    unitId: number;
    qty: number;
    unitCost: number;
    lineTotal: number;
  }[];
}

function addPurchaseLine(
  state: MockState,
  itemId: number,
  unitId: number,
  qty: number,
  unitCost: number
): void {
  const item = state.items.find((i) => i.id === itemId)!;
  const unit = item.units.find((u) => u.id === unitId)!;
  const qtyBase = toBase(item, unitId, qty);
  const costPerBase = unit.conversionToBase > 0 ? unitCost / unit.conversionToBase : unitCost;
  const lineTotal = round2(qtyBase * costPerBase);
  state.draftLines.push({ itemId, unitId, qty, unitCost, lineTotal });
}

function commitPurchase(
  state: MockState,
  supplierId: number,
  paymentType: PaymentType
): PurchaseBill {
  const now = new Date().toISOString();
  const total = round2(state.draftLines.reduce((s, l) => s + l.lineTotal, 0));
  const billId = Date.now();

  const lines: PurchaseBillLine[] = state.draftLines.map((l, idx) => {
    const item = state.items.find((i) => i.id === l.itemId)!;
    const unit = item.units.find((u) => u.id === l.unitId)!;
    const qtyBase = toBase(item, l.unitId, l.qty);
    const costPerBase = unit.conversionToBase > 0 ? l.unitCost / unit.conversionToBase : l.unitCost;
    return {
      id: billId + idx + 1,
      purchaseBillId: billId,
      itemId: l.itemId,
      unitId: l.unitId,
      qtyInPurchasedUnit: l.qty,
      qtyInBaseUnit: qtyBase,
      unitCost: l.unitCost,
      costPerBaseUnit: round2(costPerBase),
      lineTotal: l.lineTotal,
      createdAt: now,
    };
  });

  const bill: PurchaseBill = {
    id: billId,
    uuid: `uuid-pur-${billId}`,
    shopId: 1,
    supplierId,
    billDate: now,
    paymentType,
    totalAmount: total,
    syncStatus: "pending",
    createdAt: now,
    updatedAt: now,
    lines,
  };

  // Add stock
  for (const line of lines) {
    const item = state.items.find((i) => i.id === line.itemId)!;
    item.qtyInBaseUnit = round2(item.qtyInBaseUnit + line.qtyInBaseUnit);
    item.costPerBaseUnit = line.costPerBaseUnit;
  }

  // Khata for udhaar
  if (paymentType === "udhaar") {
    const txn: KhataTransaction = {
      id: billId + 5000,
      partyType: "supplier",
      partyId: supplierId,
      transactionType: "payable_incurred",
      amount: total,
      relatedPurchaseBillId: bill.id,
      transactionDate: now,
      createdAt: now,
    };
    state.khataTransactions.push(txn);
    const supplier = state.suppliers.find((s) => s.id === supplierId);
    if (supplier) {
      supplier.payableBalance = computeBalance(state.khataTransactions, "supplier", supplierId);
    }
  }

  state.purchaseBills.push(bill);
  state.draftLines = [];
  return bill;
}

// ─── Tests ───────────────────────────────────────────────────

describe("Purchase Flow — Integration", () => {
  let state: MockState;

  beforeEach(() => {
    state = {
      items: [
        makeItem(1, 20, 50),  // 20 pieces @ Rs50 sell price
        makeItem(2, 0, 100),  // 0 pieces
      ],
      suppliers: [makeSupplier(1)],
      purchaseBills: [],
      khataTransactions: [],
      draftLines: [],
    };
  });

  test("cash purchase: stock increases after commit", () => {
    addPurchaseLine(state, 1, 101, 30, 40); // buy 30 pieces @ Rs40 each
    commitPurchase(state, 1, "cash");
    expect(state.items[0].qtyInBaseUnit).toBe(50); // 20 + 30
  });

  test("cash purchase: no khata entry", () => {
    addPurchaseLine(state, 1, 101, 10, 40);
    commitPurchase(state, 1, "cash");
    expect(state.khataTransactions).toHaveLength(0);
  });

  test("cash purchase: bill is added", () => {
    addPurchaseLine(state, 1, 101, 10, 40);
    const bill = commitPurchase(state, 1, "cash");
    expect(state.purchaseBills).toHaveLength(1);
    expect(bill.totalAmount).toBe(400); // 10 × 40
  });

  test("udhaar purchase: supplier payable increases", () => {
    addPurchaseLine(state, 1, 101, 10, 40); // Rs400
    commitPurchase(state, 1, "udhaar");
    expect(state.suppliers[0].payableBalance).toBe(400);
  });

  test("udhaar purchase: khata entry created", () => {
    addPurchaseLine(state, 1, 101, 10, 40);
    commitPurchase(state, 1, "udhaar");
    expect(state.khataTransactions).toHaveLength(1);
    expect(state.khataTransactions[0].transactionType).toBe("payable_incurred");
  });

  test("purchase updates costPerBaseUnit on item", () => {
    addPurchaseLine(state, 1, 101, 10, 30); // buying at Rs30/piece
    commitPurchase(state, 1, "cash");
    expect(state.items[0].costPerBaseUnit).toBe(30);
  });

  test("box purchase: correct base qty added", () => {
    // Item 1 units: Piece (id=101), Box (id=102, 10 pieces/box)
    addPurchaseLine(state, 1, 102, 3, 350); // 3 boxes = 30 pieces, Rs350/box
    commitPurchase(state, 1, "cash");
    expect(state.items[0].qtyInBaseUnit).toBe(50); // 20 + 30
  });

  test("box purchase: correct cost per base unit", () => {
    // Rs350/box ÷ 10 pieces/box = Rs35/piece
    addPurchaseLine(state, 1, 102, 2, 350);
    commitPurchase(state, 1, "cash");
    expect(state.items[0].costPerBaseUnit).toBe(35);
  });

  test("multi-item purchase: both items get stock", () => {
    addPurchaseLine(state, 1, 101, 10, 40);
    addPurchaseLine(state, 2, 201, 25, 80);
    commitPurchase(state, 1, "cash");
    expect(state.items[0].qtyInBaseUnit).toBe(30);
    expect(state.items[1].qtyInBaseUnit).toBe(25);
  });

  test("multi-item purchase: total amount is correct", () => {
    addPurchaseLine(state, 1, 101, 10, 40); // Rs400
    addPurchaseLine(state, 2, 201, 5, 80);  // Rs400
    const bill = commitPurchase(state, 1, "cash");
    expect(bill.totalAmount).toBe(800);
  });

  test("draft is cleared after commit", () => {
    addPurchaseLine(state, 1, 101, 5, 40);
    commitPurchase(state, 1, "cash");
    expect(state.draftLines).toHaveLength(0);
  });

  test("cumulative udhaar: supplier balance accumulates", () => {
    addPurchaseLine(state, 1, 101, 10, 40); // Rs400
    commitPurchase(state, 1, "udhaar");
    addPurchaseLine(state, 2, 201, 5, 80);  // Rs400
    commitPurchase(state, 1, "udhaar");
    expect(state.suppliers[0].payableBalance).toBe(800);
  });
});
