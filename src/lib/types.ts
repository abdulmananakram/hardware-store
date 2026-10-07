// ============================================================
// Hardware Shop — Type definitions (mirror DB schema SPEC_1)
// ============================================================

export type PaymentType = "cash" | "udhaar";
export type SyncStatus = "pending" | "synced";
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

export interface Category {
  id: number;
  shopId: number;
  name: string;
  urduName?: string;
  icon: string; // emoji
  parentCategoryId: number | null;
}

export interface ItemUnit {
  id: number;
  itemId: number;
  unitName: string;
  conversionToBase: number;
  isBaseUnit: boolean;
}

export interface Item {
  id: number;
  shopId: number;
  categoryId: number;
  name: string;
  urduName?: string;
  photoUrl?: string;
  icon: string; // emoji fallback
  baseUnitName: string;
  qtyInBaseUnit: number;
  pricePerBaseUnit: number;
  costPerBaseUnit?: number;
  lowStockThreshold: number;
  isActive: boolean;
  units: ItemUnit[];
}

export interface RateHistoryEntry {
  id: number;
  itemId: number;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
}

export interface Customer {
  id: number;
  shopId: number;
  name: string;
  phone?: string;
  khataBalance: number; // positive = owes shop
  createdAt: string;
}

export interface Supplier {
  id: number;
  shopId: number;
  name: string;
  phone?: string;
  payableBalance: number; // positive = shop owes supplier
  createdAt: string;
}

export interface SaleBillLine {
  id: number;
  saleBillId: number;
  itemId: number;
  unitId: number;
  qtyInSoldUnit: number;
  qtyInBaseUnit: number;
  unitPriceAtSale: number;
  lineTotal: number;
}

export interface SaleBill {
  id: number;
  shopId: number;
  customerId: number | null;
  billDate: string;
  paymentType: PaymentType;
  totalAmount: number;
  syncStatus: SyncStatus;
  cancelled?: boolean;
  cancelReason?: string;
  lines: SaleBillLine[];
}

export interface PurchaseBillLine {
  id: number;
  purchaseBillId: number;
  itemId: number;
  unitId: number;
  qtyInPurchasedUnit: number;
  qtyInBaseUnit: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseBill {
  id: number;
  shopId: number;
  supplierId: number;
  billDate: string;
  paymentType: PaymentType;
  totalAmount: number;
  syncStatus: SyncStatus;
  cancelled?: boolean;
  lines: PurchaseBillLine[];
}

export interface Return {
  id: number;
  saleBillLineId: number;
  qtyReturnedInBaseUnit: number;
  reason: ReturnReason;
  disposition: ReturnDisposition;
  refundAmount: number;
  returnDate: string;
}

export interface KhataTransaction {
  id: number;
  partyType: PartyType;
  partyId: number;
  transactionType: KhataTxnType;
  amount: number;
  relatedBillId?: number;
  note?: string;
  transactionDate: string;
}

export interface AppNotification {
  id: number;
  type: "low_stock" | "khata_reminder";
  message: string;
  relatedItemId?: number;
  relatedCustomerId?: number;
  isRead: boolean;
  createdAt: string;
}

export interface AiImportRow {
  name: string;
  price: number;
  qty: number;
  categoryId: number | null;
}

export interface AiImportSession {
  id: number;
  sourceType: "photo" | "pdf";
  rawExtracted: { name: string; price: number }[];
  status: "awaiting_review" | "confirmed" | "discarded";
  createdAt: string;
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
  | "customer-catalog";

export interface NavParams {
  itemId?: number;
  customerId?: number;
  supplierId?: number;
  saleBillId?: number;
  saleBillLineId?: number;
  aiSessionId?: number;
  filterType?: "sales" | "purchases";
}
