// ============================================================
// Hardware Shop — Type definitions (mirror DB schema SPEC_1, v1.1)
// Schema rules (per resolution #6):
//   - TOP-LEVEL tables: shop_id + created_at + updated_at
//   - CHILD tables (lines, units, history, transactions): only created_at
//   - related_bill_id split into 3 explicit nullable FK columns
// Sync rules (per resolution #1):
//   - Every bill has a client-generated UUID (id field)
//   - Client always saves locally first, then attempts POST /sales|/purchases
//   - Server dedups by UUID (idempotency)
//   - /sync/push is just a batch wrapper around the same POST endpoints
// ============================================================

export type PaymentType = "cash" | "udhaar";
export type SyncStatus = "pending" | "syncing" | "synced" | "failed";
export type PartyType = "customer" | "supplier";
export type KhataTxnType =
  | "credit_given"
  | "payment_received"
  | "payable_incurred"
  | "payment_made";
export type ReturnReason =
  | "no_longer_needed"
  | "damaged"
  | "wrong_item"
  | "other";
export type ReturnDisposition = "back_to_sellable_stock" | "damaged_pile";
export type AdjustmentType = "restock" | "correction" | "damage" | "loss" | "initial";

// Child table — image in a category's library
export interface CategoryImage {
  id: number;
  categoryId: number;
  url: string; // e.g. "/uploads/abc123.jpg"
  isDefault: boolean; // only one per category
  createdAt: string;
}

// Top-level table — has shop_id + created_at + updated_at
export interface Category {
  id: number;
  shopId: number;
  name: string;
  urduName?: string;
  icon: string; // emoji fallback when no image
  parentCategoryId: number | null;
  // Per-resolution: default image for category (used by items that have no own photoUrl)
  defaultImageUrl?: string; // shortcut to library's default; can be set directly
  imageUrl?: string; // alias kept for compat
  createdAt: string;
  updatedAt: string;
}

// Child table — only created_at
export interface ItemUnit {
  id: number;
  itemId: number;
  unitName: string;
  conversionToBase: number;
  isBaseUnit: boolean;
  createdAt: string;
}

// Top-level table
export interface Item {
  id: number;
  shopId: number;
  categoryId: number;
  name: string;
  urduName?: string;
  photoUrl?: string;
  icon: string; // emoji fallback
  baseUnitName: string;
  // Stock tracking — always in base unit
  initialQtyInBaseUnit: number; // opening stock at item creation (per resolution #2)
  qtyInBaseUnit: number; // current stock, derived/maintained from transactions
  pricePerBaseUnit: number;
  costPerBaseUnit?: number; // last known cost (auto-derived from purchase line, per resolution #5)
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  units: ItemUnit[];
}

// Child table
export interface RateHistoryEntry {
  id: number;
  itemId: number;
  oldPrice: number;
  newPrice: number;
  changedAt: string; // created_at
}

// Child table — manual stock adjustments (per resolution #2)
export interface StockAdjustment {
  id: number;
  itemId: number;
  type: AdjustmentType;
  deltaInBaseUnit: number; // positive = add, negative = remove
  newQtyInBaseUnit: number; // snapshot after adjustment
  reason: string;
  adjustedAt: string; // created_at
}

// Top-level table
export interface Customer {
  id: number;
  shopId: number;
  name: string;
  phone?: string;
  khataBalance: number; // cached running balance; positive = owes shop
  createdAt: string;
  updatedAt: string;
}

// Top-level table
export interface Supplier {
  id: number;
  shopId: number;
  name: string;
  phone?: string;
  payableBalance: number; // cached running balance; positive = shop owes
  createdAt: string;
  updatedAt: string;
}

// Child table (line)
export interface SaleBillLine {
  id: number;
  saleBillId: number;
  itemId: number;
  unitId: number;
  qtyInSoldUnit: number;
  qtyInBaseUnit: number;
  unitPriceAtSale: number; // per base unit, snapshot
  lineTotal: number;
  // Per hardware_shop_pos_business_rules.md:
  isEstimatedWeight?: boolean;
  ratePerKg?: number;
  unroundedGrams?: number;
  roundedGrams?: number;
  costSnapshot?: number; // cost at time of sale
  isBelowCost?: boolean;
  negotiatedPrice?: number; // actual agreed unit price
  createdAt: string;
}

// Top-level table — has UUID, sync_status
export interface SaleBill {
  id: number;
  uuid: string; // client-generated, used for idempotency (per resolution #1)
  shopId: number;
  customerId: number | null;
  billDate: string;
  paymentType: PaymentType;
  totalAmount: number;
  syncStatus: SyncStatus;
  cancelled?: boolean;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  lines: SaleBillLine[];
}

// Child table (line)
export interface PurchaseBillLine {
  id: number;
  purchaseBillId: number;
  itemId: number;
  unitId: number;
  qtyInPurchasedUnit: number;
  qtyInBaseUnit: number;
  // Per resolution #5: unit_cost = cost of the SELECTED UNIT (e.g. 1 Box ki cost).
  // Base-unit cost is derived server-side: costPerBase = unitCost / conversionToBase
  unitCost: number; // per selected unit
  costPerBaseUnit: number; // derived: unitCost / conversionToBase (cached for reporting)
  lineTotal: number;
  createdAt: string;
}

// Top-level table — has UUID, sync_status
export interface PurchaseBill {
  id: number;
  uuid: string; // client-generated, for idempotency
  shopId: number;
  supplierId: number;
  billDate: string;
  paymentType: PaymentType;
  totalAmount: number;
  syncStatus: SyncStatus;
  cancelled?: boolean;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseBillLine[];
}

// Top-level table
export interface Return {
  id: number;
  saleBillLineId: number;
  qtyReturnedInBaseUnit: number;
  reason: ReturnReason;
  disposition: ReturnDisposition;
  refundAmount: number;
  returnDate: string;
  createdAt: string;
  updatedAt: string;
}

// Top-level table — Khata ledger
// Per resolution #6: related_bill_id split into 3 explicit nullable FK columns
export interface KhataTransaction {
  id: number;
  partyType: PartyType;
  partyId: number;
  transactionType: KhataTxnType;
  amount: number;
  // Three explicit FK columns instead of polymorphic related_bill_id
  relatedSaleBillId?: number;
  relatedPurchaseBillId?: number;
  relatedReturnId?: number;
  note?: string;
  transactionDate: string;
  createdAt: string;
}

// Top-level table
export interface AppNotification {
  id: number;
  shopId: number;
  type: "low_stock" | "khata_reminder";
  message: string;
  relatedItemId?: number;
  relatedCustomerId?: number;
  relatedSupplierId?: number;
  isRead: boolean;
  createdAt: string;
}

// Child / Ledger table — Permanent Inventory Movements Ledger (Per Section 4 & 9)
export type InventoryMovementType =
  | "sale"
  | "purchase"
  | "customer_return"
  | "supplier_return"
  | "damage"
  | "adjustment_pos"
  | "adjustment_neg"
  | "cancellation";

export interface InventoryMovement {
  id: number;
  itemId: number;
  type: InventoryMovementType;
  deltaInBaseUnit: number; // positive = stock in, negative = stock out
  newQtyInBaseUnit: number; // balance after movement
  referenceType: "sale_bill" | "purchase_bill" | "return" | "adjustment";
  referenceId: number;
  note?: string;
  createdAt: string;
}

// Audit trail for sensitive events (Section 12)
export interface AuditLog {
  id: number;
  action: "below_cost_sale" | "price_override" | "cancellation" | "stock_adjustment" | "category_deleted";
  details: string;
  userId?: string;
  createdAt: string;
}

// Top-level table — temporary AI session
export interface AiImportSession {
  id: number;
  shopId: number;
  sourceType: "photo" | "pdf";
  rawExtracted: { name: string; price: number }[];
  status: "awaiting_review" | "confirmed" | "discarded";
  createdAt: string;
  updatedAt: string;
}

// Per resolution #2 — confirm rows must include base_unit_name + low_stock_threshold
export interface AiImportRow {
  name: string;
  price: number;
  qty: number;
  categoryId: number | null;
  baseUnitName: string;
  lowStockThreshold: number;
}

// Shop-level config (per resolution #7 — configurable deletion window)
export interface ShopConfig {
  shopId: number;
  shopName: string;
  itemDeletionWindowDays: number; // default 90
  lowStockThresholdDefault: number; // default 10
  baseUnitDefault: string; // default "Piece"
  khataReminderThresholdDays: number; // bills older than this trigger reminder (default 7)
  khataReminderThresholdAmount: number; // balances above this trigger reminder (default 1000)
}

// ============================================================
// UI Navigation
// ============================================================

export type ScreenId =
  | "login"
  | "dashboard"
  | "inventory"
  | "item-add"
  | "item-edit"
  | "item-detail"
  | "sale-new"
  | "bill-history"
  | "purchase-new"
  | "return"
  | "customers"
  | "customer-detail"
  | "suppliers"
  | "supplier-detail"
  | "notifications"
  | "ai-import-review"
  | "ai-import-list"
  | "customer-catalog"
  | "stock-adjust"
  | "category-images"
  | "category-image-pick";

export interface NavParams {
  itemId?: number;
  customerId?: number;
  supplierId?: number;
  saleBillId?: number;
  purchaseBillId?: number;
  saleBillLineId?: number;
  aiSessionId?: number;
  filterType?: "sales" | "purchases";
  categoryId?: number; // for category-images screen
  // Callback path: where to go after picking an image from library
  pickForItemId?: number; // when picking image for a specific item
  pickForNew?: boolean; // when picking image for new item draft
}
