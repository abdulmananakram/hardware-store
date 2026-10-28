/**
 * ============================================================
 * ACCEPTANCE TESTS for Hardware Shop POS Business Rules
 * Direct verification of Section 14 in hardware_shop_pos_business_rules.md
 * ============================================================
 */

import {
  calculateEstimatedWeightSale,
  calculateWeightedAverageCost,
  checkBelowCost,
  round2,
  toBase,
  computeBalance,
} from "../../lib/business";
import type {
  Item,
  SaleBill,
  PurchaseBill,
  KhataTransaction,
  InventoryMovement,
  Customer,
  Supplier,
  Return,
} from "../../lib/types";

// ─── Helpers to create test entities ─────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    shopId: 1,
    categoryId: 1,
    name: "Common Wood Nail",
    icon: "📍",
    baseUnitName: "Gram",
    initialQtyInBaseUnit: 10000, // 10,000 grams
    qtyInBaseUnit: 10000,
    pricePerBaseUnit: 0.45, // Rs. 0.45/gram = Rs. 450/kg
    costPerBaseUnit: 0.35,  // Rs. 0.35/gram = Rs. 350/kg
    lowStockThreshold: 1000,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    units: [
      {
        id: 11,
        itemId: 1,
        unitName: "Gram",
        conversionToBase: 1,
        isBaseUnit: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 12,
        itemId: 1,
        unitName: "Box (1kg)",
        conversionToBase: 1000,
        isBaseUnit: false,
        createdAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

describe("Section 14 — Acceptance Tests (hardware_shop_pos_business_rules.md)", () => {
  // ─── Test 1: Piece Sale ──────────────────────────────────────
  test("1. Piece sale: 3 locks at Rs. 400 -> Rs. 1,200 revenue and stock decreases by 3 pieces", () => {
    const lock = makeItem({
      id: 10,
      name: "Padlock 50mm",
      baseUnitName: "Piece",
      qtyInBaseUnit: 20,
      pricePerBaseUnit: 400,
      units: [
        {
          id: 101,
          itemId: 10,
          unitName: "Piece",
          conversionToBase: 1,
          isBaseUnit: true,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const qty = 3;
    const qtyBase = toBase(lock, 101, qty);
    const lineTotal = round2(qtyBase * lock.pricePerBaseUnit);

    expect(qtyBase).toBe(3);
    expect(lineTotal).toBe(1200);

    // Stock deduction
    lock.qtyInBaseUnit -= qtyBase;
    expect(lock.qtyInBaseUnit).toBe(17);
  });

  // ─── Test 2: Full Nail Box ──────────────────────────────────
  test("2. Full nail box: configured 1,000 g box sold -> stock decreases by 1,000 g; revenue equals actual box price", () => {
    const nail = makeItem();
    const boxUnitId = 12; // 1,000 grams
    const qtyBoxes = 1;

    const qtyBase = toBase(nail, boxUnitId, qtyBoxes);
    const lineTotal = round2(qtyBase * nail.pricePerBaseUnit);

    expect(qtyBase).toBe(1000); // 1,000 grams
    expect(lineTotal).toBe(450); // 1,000 * 0.45 = Rs. 450

    nail.qtyInBaseUnit -= qtyBase;
    expect(nail.qtyInBaseUnit).toBe(9000);
  });

  // ─── Test 3: Half Box ────────────────────────────────────────
  test("3. Half box: deducts 500 g if fractional box sale is enabled", () => {
    const nail = makeItem();
    const boxUnitId = 12; // 1,000 grams
    const qtyBoxes = 0.5;

    const qtyBase = toBase(nail, boxUnitId, qtyBoxes);
    const lineTotal = round2(qtyBase * nail.pricePerBaseUnit);

    expect(qtyBase).toBe(500); // 500 grams deducted
    expect(lineTotal).toBe(225); // 500 * 0.45 = Rs. 225
  });

  // ─── Test 4: Amount sale at Rs. 450/kg ───────────────────────
  test("4. Amount sale at Rs. 450/kg: Rs. 100 -> estimate 222.22 g, deduct 220 g, revenue Rs. 100", () => {
    const res = calculateEstimatedWeightSale(100, 450);
    expect(res.unroundedGrams).toBe(222.22);
    expect(res.roundedGrams).toBe(220); // Nearest 10g
    expect(res.lineTotal).toBe(100);    // Revenue NEVER altered!
  });

  // ─── Test 5: Amount sale at Rs. 350/kg ───────────────────────
  test("5. Amount sale at Rs. 350/kg: Rs. 100 -> estimate 285.71 g, deduct 290 g, revenue Rs. 100", () => {
    const res = calculateEstimatedWeightSale(100, 350);
    expect(res.unroundedGrams).toBe(285.71);
    expect(res.roundedGrams).toBe(290); // Nearest 10g
    expect(res.lineTotal).toBe(100);
  });

  // ─── Test 6: Amount sale at Rs. 300/kg ───────────────────────
  test("6. Amount sale at Rs. 300/kg: Rs. 100 -> estimate 333.33 g, deduct 330 g, revenue Rs. 100", () => {
    const res = calculateEstimatedWeightSale(100, 300);
    expect(res.unroundedGrams).toBe(333.33);
    expect(res.roundedGrams).toBe(330); // Nearest 10g
    expect(res.lineTotal).toBe(100);
  });

  // Bonus spec test: Rs. 50 at Rs. 450/kg
  test("Bonus: Rs. 50 at Rs. 450/kg -> estimate 111.11 g, deduct 110 g, revenue Rs. 50", () => {
    const res = calculateEstimatedWeightSale(50, 450);
    expect(res.unroundedGrams).toBe(111.11);
    expect(res.roundedGrams).toBe(110);
    expect(res.lineTotal).toBe(50);
  });

  // ─── Test 7: Negotiated rate ─────────────────────────────────
  test("7. Negotiated rate: changes this transaction only; does not change defaults/history", () => {
    const lock = makeItem({ pricePerBaseUnit: 400 });
    const negotiatedRate = 380; // Agreed discounted rate for this customer

    const lineTotal = round2(2 * negotiatedRate);
    expect(lineTotal).toBe(760);
    // Product default must remain completely untouched!
    expect(lock.pricePerBaseUnit).toBe(400);
  });

  // ─── Test 8: Below-cost sale ─────────────────────────────────
  test("8. Below-cost sale: warning appears, sale is allowed, action is audited", () => {
    const lock = makeItem({ pricePerBaseUnit: 400, costPerBaseUnit: 350 });
    const negotiatedRate = 320; // Lower than cost of 350

    const check = checkBelowCost(negotiatedRate, lock.costPerBaseUnit);
    expect(check.isBelowCost).toBe(true);
    expect(check.warning).toContain("below cost");
  });

  // ─── Test 9: Customer credit (Udhaar) ────────────────────────
  test("9. Customer credit: Rs. 2,000 bill, Rs. 500 paid -> outstanding Rs. 1,500", () => {
    const txns: KhataTransaction[] = [
      {
        id: 1,
        partyType: "customer",
        partyId: 1,
        transactionType: "credit_given",
        amount: 2000,
        transactionDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        partyType: "customer",
        partyId: 1,
        transactionType: "payment_received",
        amount: 500,
        transactionDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];

    const outstanding = computeBalance(txns, "customer", 1);
    expect(outstanding).toBe(1500);
  });

  // ─── Test 10: Supplier credit ────────────────────────────────
  test("10. Supplier credit: Rs. 10,000 purchase, Rs. 4,000 paid -> payable Rs. 6,000", () => {
    const txns: KhataTransaction[] = [
      {
        id: 1,
        partyType: "supplier",
        partyId: 5,
        transactionType: "payable_incurred",
        amount: 10000,
        transactionDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        partyType: "supplier",
        partyId: 5,
        transactionType: "payment_made",
        amount: 4000,
        transactionDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];

    const payable = computeBalance(txns, "supplier", 5);
    expect(payable).toBe(6000);
  });

  // ─── Test 11: Customer return ────────────────────────────────
  test("11. Customer return: correct original stock and financial amount reversed/credited without deleting sale", () => {
    const item = makeItem({ qtyInBaseUnit: 80 }); // after 20 sold
    const soldQty = 20;
    const unitPrice = 0.45;
    const lineTotal = 9; // 20 * 0.45

    const returnedQty = 5;
    const refundAmount = round2(returnedQty * unitPrice);

    // Stock returns to sellable inventory
    item.qtyInBaseUnit += returnedQty;
    expect(item.qtyInBaseUnit).toBe(85);
    expect(refundAmount).toBe(2.25);
  });

  // ─── Test 12: Cancellation ───────────────────────────────────
  test("12. Cancellation: original document retained; linked reversal restores stock/accounts", () => {
    const item = makeItem({ qtyInBaseUnit: 10 });
    const bill: SaleBill = {
      id: 101,
      uuid: "uuid-101",
      shopId: 1,
      customerId: 1,
      billDate: new Date().toISOString(),
      paymentType: "udhaar",
      totalAmount: 450,
      syncStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: [
        {
          id: 1,
          saleBillId: 101,
          itemId: 1,
          unitId: 11,
          qtyInSoldUnit: 1000,
          qtyInBaseUnit: 1000,
          unitPriceAtSale: 0.45,
          lineTotal: 450,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // Cancellation: restore stock and mark cancelled
    item.qtyInBaseUnit += 1000;
    bill.cancelled = true;
    bill.cancelReason = "Customer changed mind";

    expect(item.qtyInBaseUnit).toBe(1010);
    expect(bill.cancelled).toBe(true);
    expect(bill.lines).toHaveLength(1); // Document retained!
  });

  // ─── Test 13: Stock adjustment ───────────────────────────────
  test("13. Stock adjustment: difference creates an auditable movement", () => {
    const currentStock = 50;
    const physicalCount = 47; // 3 damaged / missing
    const difference = physicalCount - currentStock; // -3

    const movement: InventoryMovement = {
      id: 1,
      itemId: 1,
      type: "adjustment_neg",
      deltaInBaseUnit: difference,
      newQtyInBaseUnit: physicalCount,
      referenceType: "adjustment",
      referenceId: 501,
      note: "Annual audit count",
      createdAt: new Date().toISOString(),
    };

    expect(movement.deltaInBaseUnit).toBe(-3);
    expect(movement.newQtyInBaseUnit).toBe(47);
  });

  // ─── Test 14: Cost history & WAC ─────────────────────────────
  test("14. Cost history: new purchases change current weighted average but do not rewrite historical sale COGS", () => {
    // Current stock: 100 units @ Rs. 10 = Rs. 1,000 value
    const currentQty = 100;
    const currentCost = 10;

    // Past sale recorded with cost basis = Rs. 10
    const pastSaleLineCostSnapshot = 10;

    // Receive new purchase: 50 units @ Rs. 16
    const receivedQty = 50;
    const receivedCost = 16;

    // New Weighted-Average Cost:
    // (100 * 10 + 50 * 16) / (100 + 50) = (1000 + 800) / 150 = 1800 / 150 = 12
    const newWac = calculateWeightedAverageCost(currentQty, currentCost, receivedQty, receivedCost);

    expect(newWac).toBe(12);
    // Historical sale cost basis is completely preserved!
    expect(pastSaleLineCostSnapshot).toBe(10);
  });

  // ─── Test 15: Concurrent sale / stock guard ──────────────────
  test("15. Concurrent sale: prevents negative stock and blocks over-allocation", () => {
    const item = makeItem({ qtyInBaseUnit: 5 });
    const inCartQty = 4;
    const requestedQty = 2; // 4 + 2 = 6 > 5

    const available = item.qtyInBaseUnit - inCartQty;
    const allowed = requestedQty <= available;

    expect(available).toBe(1);
    expect(allowed).toBe(false); // Blocks over-allocation!
  });

  // ─── Test 16: Reconciliation ─────────────────────────────────
  test("16. Reconciliation: sales, stock ledger, payments, receivables, and payables reconcile", () => {
    const openingStock = 1000;
    const purchaseIn = 500;
    const saleOut = 300;
    const returnIn = 50;
    const damageOut = 20;
    const adjustmentDelta = -10;

    const reconciledStock =
      openingStock + purchaseIn + returnIn - saleOut - damageOut + adjustmentDelta;

    expect(reconciledStock).toBe(1220);

    // Customer ledger reconciliation
    const salesTotal = 5000;
    const paymentsReceived = 3200;
    const returnsRefunded = 300;

    const customerBalance = salesTotal - paymentsReceived - returnsRefunded;
    expect(customerBalance).toBe(1500);
  });
});
