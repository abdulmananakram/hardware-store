/**
 * Pure business logic helpers — extracted from store.ts for testability.
 * NO Zustand, NO React, NO side effects.
 */

import type {
  KhataTransaction,
  PartyType,
  Item,
} from "./types";

/** Round to 2 decimal places with financial precision */
export const round2 = (n: number): number => {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
};

/**
 * Compute running balance for a customer or supplier from khata transactions.
 * Positive = owes the shop (customer) OR shop owes (supplier).
 */
export const computeBalance = (
  txns: KhataTransaction[],
  partyType: PartyType,
  partyId: number
): number => {
  let bal = 0;
  for (const t of txns) {
    if (t.partyType !== partyType || t.partyId !== partyId) continue;
    if (
      t.transactionType === "credit_given" ||
      t.transactionType === "payable_incurred"
    ) {
      bal += t.amount;
    } else {
      bal -= t.amount;
    }
  }
  return round2(bal);
};

/**
 * Convert qty in a given unit to base unit quantity.
 * Falls back to qty if unit not found.
 */
export const toBase = (item: Item, unitId: number, qty: number): number => {
  const u = item.units.find((x) => x.id === unitId);
  if (!u) return qty;
  return round2(qty * u.conversionToBase);
};

/**
 * Format a number as Pakistani Rupees.
 * e.g. 1234.5 → "Rs. 1,235"
 */
export const fmtRs = (n: number): string =>
  "Rs. " + Math.round(n).toLocaleString("en-PK");

/**
 * Format an ISO date string to readable date.
 */
export const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

/**
 * Stock display: returns formatted string like "5 Piece" or "2 Box (20 Piece)"
 */
export const stockDisplay = (item: Item): string => {
  const baseUnit = item.units.find((u) => u.isBaseUnit);
  const baseUnitName = baseUnit?.unitName ?? item.baseUnitName;
  const largest = item.units
    .filter((u) => !u.isBaseUnit && u.conversionToBase > 1)
    .sort((a, b) => b.conversionToBase - a.conversionToBase)[0];

  if (!largest) return `${item.qtyInBaseUnit} ${baseUnitName}`;
  const bigQty = Math.floor(item.qtyInBaseUnit / largest.conversionToBase);
  const remainder = round2(
    item.qtyInBaseUnit - bigQty * largest.conversionToBase
  );
  if (bigQty === 0) return `${remainder} ${baseUnitName}`;
  if (remainder === 0)
    return `${bigQty} ${largest.unitName} (${item.qtyInBaseUnit} ${baseUnitName})`;
  return `${bigQty} ${largest.unitName} + ${remainder} ${baseUnitName} (${item.qtyInBaseUnit} ${baseUnitName})`;
};

/**
 * Check if a category can be safely deleted (no active items using it).
 */
export const canDeleteCategory = (
  items: Item[],
  categoryId: number
): { ok: boolean; error?: string } => {
  const inUse = items.some((i) => i.isActive && i.categoryId === categoryId);
  if (inUse)
    return {
      ok: false,
      error: "اس category میں items ہیں — پہلے items کو کسی اور category میں move کریں",
    };
  return { ok: true };
};

/**
 * Amount-based estimated-weight sale calculation (Section 5 & Acceptance Tests 4, 5, 6)
 *
 * Rules:
 * 1. Exact estimated grams = (sale_amount / rate_per_kg) * 1000
 * 2. Stock deduction = exact estimate rounded to the nearest 10g (half-up)
 * 3. Critical rule: Revenue remains the exact amount charged to the customer!
 *
 * Examples:
 * - Rs. 100 at Rs. 450/kg -> 222.22 g -> 220 g deducted; revenue Rs. 100
 * - Rs. 100 at Rs. 350/kg -> 285.71 g -> 290 g deducted; revenue Rs. 100
 * - Rs. 100 at Rs. 300/kg -> 333.33 g -> 330 g deducted; revenue Rs. 100
 * - Rs. 50 at Rs. 450/kg  -> 111.11 g -> 110 g deducted; revenue Rs. 50
 */
export const calculateEstimatedWeightSale = (
  saleAmount: number,
  ratePerKg: number
): {
  unroundedGrams: number;
  roundedGrams: number;
  lineTotal: number;
} => {
  if (ratePerKg <= 0) {
    throw new Error("Rate per kg must be greater than zero");
  }
  if (saleAmount <= 0) {
    throw new Error("Sale amount must be greater than zero");
  }

  const unroundedGrams = (saleAmount / ratePerKg) * 1000;
  // Round to nearest 10 grams (half-up deterministic rule)
  const roundedGrams = Math.round((unroundedGrams + Number.EPSILON) / 10) * 10;

  return {
    unroundedGrams: round2(unroundedGrams),
    roundedGrams,
    lineTotal: round2(saleAmount), // Revenue remains the exact amount charged
  };
};

/**
 * Weighted-Average Costing (WAC) for Purchases (Section 6 & Acceptance Test 14)
 *
 * Formula:
 * new_avg_cost = ((old_inventory_value) + (new_received_cost)) / (old_base_qty + new_received_base_qty)
 * If old_qty <= 0, returns the new line cost.
 */
export const calculateWeightedAverageCost = (
  currentQty: number,
  currentCost: number,
  addedQty: number,
  addedCost: number
): number => {
  if (currentQty <= 0) {
    return round2(addedCost);
  }
  const currentVal = currentQty * currentCost;
  const addedVal = addedQty * addedCost;
  const totalQty = currentQty + addedQty;
  return totalQty > 0 ? round2((currentVal + addedVal) / totalQty) : round2(addedCost);
};

/**
 * Check if a proposed selling price is below cost (Section 2 #2 & Acceptance Test 8)
 * Shows a warning, permits the sale, and enables audit logging.
 */
export const checkBelowCost = (
  unitPriceAtSale: number,
  costPerBaseUnit?: number
): { isBelowCost: boolean; warning?: string } => {
  if (costPerBaseUnit && costPerBaseUnit > 0 && unitPriceAtSale < costPerBaseUnit) {
    return {
      isBelowCost: true,
      warning: `Selling price (Rs. ${unitPriceAtSale}) is below cost (Rs. ${costPerBaseUnit}). Sale will be recorded and audited.`,
    };
  }
  return { isBelowCost: false };
};

