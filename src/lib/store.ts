"use client";

import { create } from "zustand";
import {
  Category,
  Item,
  ItemUnit,
  Customer,
  Supplier,
  SaleBill,
  PurchaseBill,
  Return,
  KhataTransaction,
  AppNotification,
  RateHistoryEntry,
  AiImportSession,
  ShopConfig,
  StockAdjustment,
  CategoryImage,
  PaymentType,
  ScreenId,
  NavParams,
  PartyType,
  KhataTxnType,
  ReturnReason,
  ReturnDisposition,
  AdjustmentType,
  SyncStatus,
  InventoryMovement,
  AuditLog,
  SaleMode,
  CatalogueAttribute,
  CatalogueAttributeOption,
  LocalPayment,
} from "./types";
import { loadLocalSnapshot, saveLocalSnapshot } from "./localDb";
import { hasLocalPin, setLocalPin, verifyLocalPin } from "./localAuth";
import {
  round2,
  computeBalance,
  toBase,
  canDeleteCategory,
  calculateEstimatedWeightSale,
  calculateWeightedAverageCost,
  checkBelowCost,
} from "./business";
import {
  createLocalPurchase,
  createLocalSale,
  createLocalStockAdjustment,
  recordLocalPayment,
} from "./localServices";
import { generateLocalNotifications } from "./localNotifications";

// ============================================================
// Store shape
// ============================================================

interface AppState {
  // Auth
  isAuthed: boolean;
  login: (pin: string) => Promise<boolean>;
  pinConfigured: boolean;
  initializeLocalAuth: () => Promise<void>;
  setOwnerPin: (pin: string) => Promise<void>;
  hydrateFromServer: () => Promise<boolean>;

  // Navigation
  screen: ScreenId;
  params: NavParams;
  history: { screen: ScreenId; params: NavParams }[];
  navigate: (screen: ScreenId, params?: NavParams) => void;
  goBack: () => void;

  // Shop config
  shopConfig: ShopConfig;
  updateShopConfig: (patch: Partial<ShopConfig>) => void;

  // Connectivity (per resolution #1)
  isOnline: boolean;
  setOnline: (online: boolean) => void;

  // Data — top-level tables
  categories: Category[];
  items: Item[];
  customers: Customer[];
  suppliers: Supplier[];
  saleBills: SaleBill[];
  purchaseBills: PurchaseBill[];
  returns: Return[];
  khataTransactions: KhataTransaction[];
  notifications: AppNotification[];
  rateHistory: RateHistoryEntry[];
  aiSessions: AiImportSession[];
  stockAdjustments: StockAdjustment[];
  categoryImages: CategoryImage[]; // library per category
  inventoryMovements: InventoryMovement[]; // Permanent inventory ledger (Section 4 & 9)
  auditLogs: AuditLog[]; // Audit trail (Section 12)
  attributes: CatalogueAttribute[];
  attributeOptions: CatalogueAttributeOption[];
  payments: LocalPayment[];

  // ============================================================
  // Image library actions (per Category image library feature)
  // ============================================================

  // Upload an image file to /api/upload, return the URL. Used by all image actions.
  uploadImageFile: (file: File) => Promise<{ ok: boolean; url?: string; error?: string }>;

  // Add an existing URL (already uploaded) to a category's library
  addImageToCategoryLibrary: (categoryId: number, url: string, makeDefault?: boolean) => CategoryImage;

  // Set an image as the category's default (only one per category)
  setCategoryDefaultImage: (categoryId: number, imageId: number) => void;

  // Remove an image from the library (also clears default if it was the default)
  deleteCategoryImage: (imageId: number) => void;

  // Get the display URL for an item (priority: item.photoUrl → category default → undefined)
  getItemImageUrl: (item: Item) => string | undefined;

  // Get all images in a category's library
  getCategoryImages: (categoryId: number) => CategoryImage[];

  // Set the photoUrl on an item (e.g. when user picks from library or uploads new)
  setItemPhoto: (itemId: number, url: string | undefined) => void;

  // For new-item draft: temporarily hold the chosen photo URL until item is saved
  draftItemPhoto: string | undefined;
  setDraftItemPhoto: (url: string | undefined) => void;

  // Sale draft
  draftSale: {
    customerId: number | null;
    paymentType: PaymentType;
    lines: {
      tempId: string;
      itemId: number;
      unitId: number;
      qty: number;
      lineTotal: number;
      saleMode?: SaleMode;
      customUnitPrice?: number;
      isEstimatedWeight?: boolean;
      ratePerKg?: number;
      unroundedGrams?: number;
      roundedGrams?: number;
      isBelowCost?: boolean;
      warning?: string;
    }[];
  };
  draftSaleAddLine: (
    itemId: number,
    unitId: number,
    qty: number,
    customUnitPrice?: number,
    estimatedWeight?: { ratePerKg: number; saleAmount: number }
  ) => { ok: boolean; error?: string; warning?: string };
  draftSaleRemoveLine: (tempId: string) => void;
  draftSaleSetCustomer: (id: number | null) => void;
  draftSaleSetPayment: (t: PaymentType) => void;
  draftSaleTotal: () => number;
  commitSale: () => SaleBill;

  // Purchase draft
  draftPurchase: {
    supplierId: number | null;
    paymentType: PaymentType;
    lines: {
      tempId: string;
      itemId: number;
      unitId: number;
      qty: number;
      unitCost: number; // per selected unit (per resolution #5)
      lineTotal: number;
    }[];
  };
  draftPurchaseAddLine: (itemId: number, unitId: number, qty: number, unitCost: number) => void;
  draftPurchaseRemoveLine: (tempId: string) => void;
  draftPurchaseSetSupplier: (id: number | null) => void;
  draftPurchaseSetPayment: (t: PaymentType) => void;
  draftPurchaseTotal: () => number;
  commitPurchase: () => PurchaseBill;

  // Inventory CRUD
  addItem: (data: {
    name: string;
    urduName?: string;
    skuCode?: string;
    brand?: string;
    specification?: string;
    notes?: string;
    categoryId: number;
    baseUnitName: string;
    pricePerBaseUnit: number;
    lowStockThreshold: number;
    icon: string;
    initialQtyInBaseUnit: number; // opening stock (per resolution #2)
    photoUrl?: string; // optional product image (overrides category default)
    extraUnits?: { unitName: string; conversionToBase: number }[];
    saleMode?: SaleMode;
    fractionalPackAllowed?: boolean;
  }) => Item;
  updateItem: (id: number, data: Partial<Item>) => void;
  softDeleteItem: (id: number) => { ok: boolean; error?: string };

  // Stock Adjustment (per resolution #2)
  adjustStock: (
    itemId: number,
    type: AdjustmentType,
    deltaInBaseUnit: number,
    reason: string
  ) => { ok: boolean; error?: string; adjustment?: StockAdjustment };

  // Category CRUD
  addCategory: (name: string, icon: string) => Category;
  deleteCategory: (id: number) => { ok: boolean; error?: string };

  // Customer / Supplier
  addCustomer: (name: string, phone?: string) => { ok: boolean; customer?: Customer; warning?: string };
  addSupplier: (name: string, phone?: string) => { ok: boolean; supplier?: Supplier; warning?: string };
  recordCustomerPayment: (customerId: number, amount: number, note?: string) => void;
  recordSupplierPayment: (supplierId: number, amount: number, note?: string) => void;

  // Returns
  recordReturn: (
    saleBillLineId: number,
    qtyReturnedInBaseUnit: number,
    reason: ReturnReason,
    disposition: ReturnDisposition
  ) => { ok: boolean; error?: string; returnEntry?: Return };

  // Bill cancellation — both sales and purchases (per resolution #4)
  cancelSaleBill: (id: number, reason: string) => { ok: boolean; error?: string };
  cancelPurchaseBill: (id: number, reason: string) => { ok: boolean; error?: string };

  // Sync (per resolution #1) — single canonical flow with UUID idempotency
  pendingSyncCount: () => number;
  pushSync: () => void; // batch wrapper around POST /sales|/purchases
  // Internal: pushes a single bill (sale or purchase) to the server endpoint
  pushBill: (billUuid: string) => void;

  // Notifications
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
  // Khata reminder trigger (per resolution #7) — checks old bills + high balances
  triggerKhataReminders: () => void;

  // AI Import (per resolution #2) — confirm requires base_unit_name + low_stock_threshold
  createAiSession: (rows: { name: string; price: number }[], source: "photo" | "pdf") => number;
  confirmAiImport: (
    sessionId: number,
    rows: {
      name: string;
      price: number;
      qty: number;
      categoryId: number;
      baseUnitName: string; // required per resolution #2
      lowStockThreshold: number; // required per resolution #2
    }[]
  ) => number;

  // Helpers
  getItem: (id: number) => Item | undefined;
  getCategory: (id: number) => Category | undefined;
  getCustomer: (id: number) => Customer | undefined;
  getSupplier: (id: number) => Supplier | undefined;
  getUnit: (itemId: number, unitId: number) => ItemUnit | undefined;
  customerBalance: (customerId: number) => number;
  supplierBalance: (supplierId: number) => number;
}

// ============================================================
// Internal helpers
// ============================================================

const uid = (() => {
  let n = 5000;
  return () => ++n;
})();

const tempId = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();

const defaultShopConfig: ShopConfig = {
  shopId: 1,
  shopName: "Hardware Shop",
  itemDeletionWindowDays: 90,
  lowStockThresholdDefault: 10,
  baseUnitDefault: "Piece",
  khataReminderThresholdDays: 7,
  khataReminderThresholdAmount: 1000,
  language: "en",
};

// Per resolution #1 — client-generated UUID for idempotency
const generateUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// ============================================================
// Store
// ============================================================

const initialDraftSale = {
  customerId: null as number | null,
  paymentType: "cash" as PaymentType,
  lines: [],
};

const initialDraftPurchase = {
  supplierId: null as number | null,
  paymentType: "cash" as PaymentType,
  lines: [],
};

export const useApp = create<AppState>()(
    (set, get) => ({
      isAuthed: false,
      pinConfigured: false,
      initializeLocalAuth: async () => {
        if (typeof window === "undefined") return;
        set({ pinConfigured: await hasLocalPin() });
      },
      setOwnerPin: async (pin) => {
        await setLocalPin(pin);
        set({ pinConfigured: true });
      },
      login: async (pin) => {
        if (typeof window === "undefined") return false;
        try {
          if (await verifyLocalPin(pin)) {
            set({ isAuthed: true, screen: "dashboard" });
            void get().hydrateFromServer();
            return true;
          }
          return false;
        } catch (error) {
          console.error("Local login failed", error);
          return false;
        }
      },
      hydrateFromServer: async () => {
        const local = await loadLocalSnapshot().catch(() => null);
        if (local) set(local);
        try {
          const response = await fetch("/api/bootstrap", { credentials: "include" });
          if (!response.ok) return Boolean(local);
          const payload = (await response.json()) as Partial<AppState>;
          set({
            ...payload,
            isAuthed: true,
          });
          await saveLocalSnapshot({
            shopConfig: payload.shopConfig ?? defaultShopConfig,
            categories: payload.categories ?? [],
            items: payload.items ?? [],
            customers: payload.customers ?? [],
            suppliers: payload.suppliers ?? [],
            saleBills: payload.saleBills ?? [],
            purchaseBills: payload.purchaseBills ?? [],
            returns: payload.returns ?? [],
            khataTransactions: payload.khataTransactions ?? [],
            notifications: payload.notifications ?? [],
            rateHistory: payload.rateHistory ?? [],
            aiSessions: payload.aiSessions ?? [],
            stockAdjustments: payload.stockAdjustments ?? [],
            categoryImages: payload.categoryImages ?? [],
            inventoryMovements: payload.inventoryMovements ?? [],
            auditLogs: payload.auditLogs ?? [],
            attributes: payload.attributes ?? [],
            attributeOptions: payload.attributeOptions ?? [],
            payments: payload.payments ?? [],
          });
          return true;
        } catch (error) {
          console.error("Bootstrap failed; using local database", error);
          return Boolean(local);
        }
      },

      screen: "dashboard",
      params: {},
      history: [],
  navigate: (screen, params = {}) =>
    set((s) => ({
      screen,
      params,
      history: [...s.history, { screen: s.screen, params: s.params }].slice(-20),
    })),
  goBack: () =>
    set((s) => {
      if (s.history.length === 0) return { screen: "dashboard" as ScreenId, params: {} };
      const last = s.history[s.history.length - 1];
      return {
        screen: last.screen,
        params: last.params,
        history: s.history.slice(0, -1),
      };
    }),

  shopConfig: defaultShopConfig,
  updateShopConfig: (patch) =>
    set((s) => ({ shopConfig: { ...s.shopConfig, ...patch } })),

  isOnline: true,
  // Per resolution #1 — when coming back online, auto-trigger push of all pending bills
  setOnline: (online) => {
    set({ isOnline: online });
    if (online) {
      get().pushSync();
    }
  },

  categories: [],
  items: [],
  customers: [],
  suppliers: [],
  saleBills: [],
  purchaseBills: [],
  returns: [],
  khataTransactions: [],
  notifications: [],
  rateHistory: [],
  aiSessions: [],
  stockAdjustments: [],
  categoryImages: [],
  inventoryMovements: [],
  auditLogs: [],
  attributes: [],
  attributeOptions: [],
  payments: [],

  draftItemPhoto: undefined,
  setDraftItemPhoto: (url) => set({ draftItemPhoto: url }),

  // ============================================================
  // Image library implementations
  // ============================================================

  uploadImageFile: async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: "Upload failed" }));
        return { ok: false, error: errBody.message || `Upload failed (${res.status})` };
      }
      const data = await res.json();
      return { ok: true, url: data.url as string };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error during upload" };
    }
  },

  addImageToCategoryLibrary: (categoryId, url, makeDefault) => {
    
    const ts = now();
    const newImg: CategoryImage = {
      id: uid(),
      categoryId,
      url,
      isDefault: !!makeDefault,
      createdAt: ts,
    };
    set((st) => {
      // If makeDefault, unset other defaults in same category
      const newImages = makeDefault
        ? st.categoryImages.map((img) =>
            img.categoryId === categoryId ? { ...img, isDefault: false } : img
          )
        : st.categoryImages;
      // If this is the first image in the category, auto-mark as default
      const isFirst =
        !makeDefault &&
        !st.categoryImages.some((img) => img.categoryId === categoryId);
      if (isFirst) newImg.isDefault = true;

      const updatedCategories = (makeDefault || isFirst)
        ? st.categories.map((c) =>
            c.id === categoryId
              ? { ...c, defaultImageUrl: newImg.url, imageUrl: newImg.url, updatedAt: now() }
              : c
          )
        : st.categories;

      return {
        categoryImages: [...newImages, newImg],
        categories: updatedCategories,
      };
    });
    return newImg;
  },

  setCategoryDefaultImage: (categoryId, imageId) => {
    
    set((st) => {
      const img = st.categoryImages.find((i) => i.id === imageId);
      if (!img) return {};
      return {
        categoryImages: st.categoryImages.map((i) =>
          i.categoryId === categoryId
            ? { ...i, isDefault: i.id === imageId }
            : i
        ),
        categories: st.categories.map((c) =>
          c.id === categoryId
            ? { ...c, defaultImageUrl: img.url, imageUrl: img.url, updatedAt: now() }
            : c
        ),
      };
    });
  },

  deleteCategoryImage: (imageId) => {
    
    set((st) => {
      const img = st.categoryImages.find((i) => i.id === imageId);
      if (!img) return {};
      const wasDefault = img.isDefault;
      const remaining = st.categoryImages.filter((i) => i.id !== imageId);
      // If deleted image was default, promote the next image in same category
      let newDefaultUrl: string | undefined = undefined;
      if (wasDefault) {
        const next = remaining.find((i) => i.categoryId === img.categoryId);
        if (next) {
          next.isDefault = true;
          newDefaultUrl = next.url;
        }
      }
      return {
        categoryImages: remaining,
        items: st.items.map((it) =>
          it.photoUrl === img.url ? { ...it, photoUrl: undefined, updatedAt: now() } : it
        ),
        categories: st.categories.map((c) =>
          c.id === img.categoryId
            ? {
                ...c,
                defaultImageUrl: newDefaultUrl,
                imageUrl: newDefaultUrl,
                updatedAt: now(),
              }
            : c
        ),
      };
    });
  },

  getItemImageUrl: (item) => {
    if (item.photoUrl) return item.photoUrl;
    const cat = get().categories.find((c) => c.id === item.categoryId);
    return cat?.defaultImageUrl || cat?.imageUrl;
  },

  getCategoryImages: (categoryId) =>
    get().categoryImages.filter((i) => i.categoryId === categoryId),

  setItemPhoto: (itemId, url) => {
    
    set((st) => ({
      items: st.items.map((i) =>
        i.id === itemId ? { ...i, photoUrl: url, updatedAt: now() } : i
      ),
    }));
  },

  draftSale: initialDraftSale,
  draftPurchase: initialDraftPurchase,

  draftSaleAddLine: (itemId, unitId, qty, customUnitPrice, estimatedWeight) => {
    const state = get();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: "Item not found" };

    let qtyBase = 0;
    let lineTotal = 0;
    let isEstimatedWeight = false;
    let ratePerKg: number | undefined = undefined;
    let unroundedGrams: number | undefined = undefined;
    let roundedGrams: number | undefined = undefined;
    let warning: string | undefined = undefined;
    let isBelowCost = false;

    if (estimatedWeight) {
      // Amount-based estimated-weight sale (Section 5 & Acceptance Tests 4, 5, 6)
      if (estimatedWeight.saleAmount <= 0) return { ok: false, error: "Enter a valid sale amount" };
      if (estimatedWeight.ratePerKg <= 0) return { ok: false, error: "Rate per kg must be greater than zero" };

      const calc = calculateEstimatedWeightSale(estimatedWeight.saleAmount, estimatedWeight.ratePerKg);
      unroundedGrams = calc.unroundedGrams;
      roundedGrams = calc.roundedGrams;
      lineTotal = calc.lineTotal;
      isEstimatedWeight = true;
      ratePerKg = estimatedWeight.ratePerKg;

      const isKgBase = item.baseUnitName.toLowerCase() === "kg" || item.baseUnitName.toLowerCase() === "kilogram";
      qtyBase = isKgBase ? round2(roundedGrams / 1000) : roundedGrams;

      const itemCostPerKg = isKgBase ? (item.costPerBaseUnit || 0) : ((item.costPerBaseUnit || 0) * 1000);
      const costCheck = checkBelowCost(estimatedWeight.ratePerKg, itemCostPerKg);
      isBelowCost = costCheck.isBelowCost;
      if (costCheck.isBelowCost) warning = costCheck.warning;
    } else {
      if (!qty || qty <= 0 || isNaN(qty)) return { ok: false, error: "Enter a valid quantity" };
      qtyBase = toBase(item, unitId, qty);
      const unitPrice = customUnitPrice !== undefined && customUnitPrice >= 0 ? customUnitPrice : item.pricePerBaseUnit;
      lineTotal = round2(qtyBase * unitPrice);

      const costCheck = checkBelowCost(unitPrice, item.costPerBaseUnit);
      isBelowCost = costCheck.isBelowCost;
      if (costCheck.isBelowCost) warning = costCheck.warning;
    }

    // Check existing quantity of this item already in current sale cart
    const inCartBase = state.draftSale.lines
      .filter((l) => l.itemId === itemId)
      .reduce((sum, l) => sum + (l.isEstimatedWeight ? (l.roundedGrams ?? l.qty) : toBase(item, l.unitId, l.qty)), 0);
    const totalRequestedBase = round2(inCartBase + qtyBase);

    if (totalRequestedBase > item.qtyInBaseUnit) {
      const u = item.units.find((x) => x.id === unitId);
      const remainingBase = Math.max(0, item.qtyInBaseUnit - inCartBase);
      const availSold = remainingBase / (u?.conversionToBase || 1);
      return {
        ok: false,
        error: `Only ${Math.floor(availSold)} ${u?.unitName || item.baseUnitName} more available (already ${inCartBase} in cart)`,
      };
    }

    set((s) => ({
      draftSale: {
        ...s.draftSale,
        lines: [
          ...s.draftSale.lines,
          {
            tempId: tempId(),
            itemId,
            unitId,
            qty: isEstimatedWeight ? (roundedGrams ?? qty) : qty,
            lineTotal,
            saleMode: (item.saleMode as SaleMode | null | undefined) ?? "QTY",
            customUnitPrice,
            isEstimatedWeight,
            ratePerKg,
            unroundedGrams,
            roundedGrams,
            isBelowCost,
            warning,
          },
        ],
      },
    }));
    return { ok: true, warning };
  },
  draftSaleRemoveLine: (tid) =>
    set((s) => ({
      draftSale: { ...s.draftSale, lines: s.draftSale.lines.filter((l) => l.tempId !== tid) },
    })),
  draftSaleSetCustomer: (id) => set((s) => ({ draftSale: { ...s.draftSale, customerId: id } })),
  draftSaleSetPayment: (t) => set((s) => ({ draftSale: { ...s.draftSale, paymentType: t } })),
  draftSaleTotal: () => get().draftSale.lines.reduce((sum, l) => sum + l.lineTotal, 0),

  commitSale: () => {
    const s = get();
    const total = round2(s.draftSale.lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const billId = uid();
    const billUuid = generateUuid(); // client-generated, for idempotency

    // Per resolution #3 — Udhaar requires customer (no partial/split in v1)
    const bill: SaleBill = {
      id: billId,
      uuid: billUuid,
      shopId: 1,
      customerId: s.draftSale.customerId,
      billDate: now(),
      paymentType: s.draftSale.paymentType,
      totalAmount: total,
      syncStatus: "pending",
      createdAt: now(),
      updatedAt: now(),
      lines: s.draftSale.lines.map((l) => {
        const item = s.items.find((x) => x.id === l.itemId)!;
        const qtyBase = l.isEstimatedWeight
          ? (item.baseUnitName.toLowerCase() === "kg" ? round2((l.roundedGrams || 0) / 1000) : (l.roundedGrams || 0))
          : toBase(item, l.unitId, l.qty);
        return {
          id: uid(),
          saleBillId: billId,
          itemId: l.itemId,
          unitId: l.unitId,
          qtyInSoldUnit: l.qty,
          qtyInBaseUnit: qtyBase,
          unitPriceAtSale: l.customUnitPrice ?? item.pricePerBaseUnit,
          lineTotal: l.lineTotal,
          saleMode: l.saleMode ?? (item.saleMode as SaleMode | null | undefined) ?? "QTY",
          isEstimatedWeight: l.isEstimatedWeight,
          ratePerKg: l.ratePerKg,
          unroundedGrams: l.unroundedGrams,
          roundedGrams: l.roundedGrams,
          costSnapshot: item.costPerBaseUnit,
          isBelowCost: l.isBelowCost,
          negotiatedPrice: l.customUnitPrice,
          createdAt: now(),
        };
      }),
    };

    // Atomic update: deduct stock + add bill + khata entry + low-stock check + inventory movements + audit
    set((st) => {
      const newItems = st.items.map((it) => {
        const deducted = bill.lines
          .filter((l) => l.itemId === it.id)
          .reduce((sum, l) => sum + l.qtyInBaseUnit, 0);
        if (deducted === 0) return it;
        return { ...it, qtyInBaseUnit: round2(it.qtyInBaseUnit - deducted), updatedAt: now() };
      });

      // Record permanent inventory ledger movement for each line
      const newMovements: InventoryMovement[] = bill.lines.map((l) => {
        const it = newItems.find((x) => x.id === l.itemId)!;
        return {
          id: uid(),
          itemId: l.itemId,
          type: "sale" as const,
          deltaInBaseUnit: -l.qtyInBaseUnit,
          newQtyInBaseUnit: it.qtyInBaseUnit,
          referenceType: "sale_bill" as const,
          referenceId: bill.id,
          note: l.isEstimatedWeight
            ? `Estimated weight sale (${l.roundedGrams}g deducted, rounded from ${l.unroundedGrams}g)`
            : `Sale of ${l.qtyInSoldUnit}`,
          createdAt: now(),
        };
      });

      // Audit below cost and price overrides
      const newAuditLogs = [...st.auditLogs];
      for (const l of bill.lines) {
        if (l.isBelowCost) {
          newAuditLogs.unshift({
            id: uid(),
            action: "below_cost_sale" as const,
            details: `Sale #${bill.id} item #${l.itemId} sold below cost (sold at Rs. ${l.unitPriceAtSale}, cost: Rs. ${l.costSnapshot || 0})`,
            createdAt: now(),
          });
        }
        if (l.negotiatedPrice !== undefined) {
          newAuditLogs.unshift({
            id: uid(),
            action: "price_override" as const,
            details: `Sale #${bill.id} item #${l.itemId} negotiated price Rs. ${l.negotiatedPrice}`,
            createdAt: now(),
          });
        }
      }

      const newKhata =
        bill.paymentType === "udhaar" && bill.customerId
          ? [
              ...st.khataTransactions,
              {
                id: uid(),
                partyType: "customer" as PartyType,
                partyId: bill.customerId,
                transactionType: "credit_given" as KhataTxnType,
                amount: bill.totalAmount,
                relatedSaleBillId: bill.id,
                transactionDate: now(),
                createdAt: now(),
              },
            ]
          : st.khataTransactions;

      const newCustomers = st.customers.map((c) =>
        c.id === bill.customerId
          ? { ...c, khataBalance: computeBalance(newKhata, "customer", c.id), updatedAt: now() }
          : c
      );

      const newNotifs = [...st.notifications];
      for (const it of newItems) {
        if (it.qtyInBaseUnit <= it.lowStockThreshold) {
          const exists = newNotifs.some(
            (n) => n.type === "low_stock" && n.relatedItemId === it.id && !n.isRead
          );
          if (!exists) {
            newNotifs.unshift({
              id: uid(),
              shopId: 1,
              type: "low_stock",
              message: `${it.name} is low on stock (${it.qtyInBaseUnit} ${it.baseUnitName} left)`,
              relatedItemId: it.id,
              isRead: false,
              createdAt: now(),
            });
          }
        }
      }

      return {
        saleBills: [bill, ...st.saleBills],
        items: newItems,
        inventoryMovements: [...newMovements, ...st.inventoryMovements],
        auditLogs: newAuditLogs,
        khataTransactions: newKhata,
        customers: newCustomers,
        notifications: newNotifs,
        draftSale: { ...initialDraftSale },
      };
    });

    // Per resolution #1: immediately try POST /sales if online (single canonical flow)
    void createLocalSale({
      uuid: billUuid,
      customerId: bill.customerId,
      paymentType: bill.paymentType,
      amountPaid: bill.amountPaid,
      lines: bill.lines.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        qty: line.qtyInSoldUnit,
        unitPrice: line.negotiatedPrice,
        saleMode: line.saleMode,
        estimatedWeight: line.isEstimatedWeight && line.ratePerKg
          ? { ratePerKg: line.ratePerKg, saleAmount: line.lineTotal }
          : undefined,
      })),
    }).catch((error) => console.error("Local sale transaction failed", error));
    if (get().isOnline) get().pushBill(billUuid);

    return bill;
  },

  draftPurchaseAddLine: (itemId, unitId, qty, unitCost) => {
    const state = get();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    const unit = item.units.find((u) => u.id === unitId);
    if (!unit) return;
    const qtyBase = toBase(item, unitId, qty);
    // Per resolution #5: line_total = qty_base * (unitCost / conversionToBase)
    const costPerBase = unit.conversionToBase > 0 ? unitCost / unit.conversionToBase : unitCost;
    const lineTotal = round2(qtyBase * costPerBase);
    set((s) => ({
      draftPurchase: {
        ...s.draftPurchase,
        lines: [
          ...s.draftPurchase.lines,
          { tempId: tempId(), itemId, unitId, qty, unitCost, lineTotal },
        ],
      },
    }));
  },
  draftPurchaseRemoveLine: (tid) =>
    set((s) => ({
      draftPurchase: { ...s.draftPurchase, lines: s.draftPurchase.lines.filter((l) => l.tempId !== tid) },
    })),
  draftPurchaseSetSupplier: (id) => set((s) => ({ draftPurchase: { ...s.draftPurchase, supplierId: id } })),
  draftPurchaseSetPayment: (t) => set((s) => ({ draftPurchase: { ...s.draftPurchase, paymentType: t } })),
  draftPurchaseTotal: () => get().draftPurchase.lines.reduce((sum, l) => sum + l.lineTotal, 0),

  commitPurchase: () => {
    const s = get();
    const total = round2(s.draftPurchase.lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const billId = uid();
    const billUuid = generateUuid();

    const bill: PurchaseBill = {
      id: billId,
      uuid: billUuid,
      shopId: 1,
      supplierId: s.draftPurchase.supplierId!,
      billDate: now(),
      paymentType: s.draftPurchase.paymentType,
      totalAmount: total,
      syncStatus: "pending",
      createdAt: now(),
      updatedAt: now(),
      lines: s.draftPurchase.lines.map((l) => {
        const item = s.items.find((x) => x.id === l.itemId)!;
        const unit = item.units.find((u) => u.id === l.unitId)!;
        const qtyBase = toBase(item, l.unitId, l.qty);
        // Per resolution #5: server derives base cost from unitCost
        const costPerBase = unit.conversionToBase > 0 ? l.unitCost / unit.conversionToBase : l.unitCost;
        return {
          id: uid(),
          purchaseBillId: billId,
          itemId: l.itemId,
          unitId: l.unitId,
          qtyInPurchasedUnit: l.qty,
          qtyInBaseUnit: qtyBase,
          unitCost: l.unitCost, // cost per selected unit
          costPerBaseUnit: round2(costPerBase), // derived
          lineTotal: l.lineTotal,
          createdAt: now(),
        };
      }),
    };

    set((st) => {
      const newItems = st.items.map((it) => {
        const added = bill.lines
          .filter((l) => l.itemId === it.id)
          .reduce((sum, l) => sum + l.qtyInBaseUnit, 0);
        if (added === 0) return it;
        const lineCost = bill.lines.find((l) => l.itemId === it.id)?.costPerBaseUnit ?? it.costPerBaseUnit ?? 0;
        // Per Section 6 & Acceptance Test 14: Weighted-Average Costing
        const newCost = calculateWeightedAverageCost(
          it.qtyInBaseUnit,
          it.costPerBaseUnit || lineCost,
          added,
          lineCost
        );
        return {
          ...it,
          qtyInBaseUnit: round2(it.qtyInBaseUnit + added),
          costPerBaseUnit: newCost,
          updatedAt: now(),
        };
      });

      // Permanent inventory ledger movement for each purchase line
      const newMovements: InventoryMovement[] = bill.lines.map((l) => {
        const it = newItems.find((x) => x.id === l.itemId)!;
        return {
          id: uid(),
          itemId: l.itemId,
          type: "purchase" as const,
          deltaInBaseUnit: l.qtyInBaseUnit,
          newQtyInBaseUnit: it.qtyInBaseUnit,
          referenceType: "purchase_bill" as const,
          referenceId: bill.id,
          note: `Received purchase from supplier #${bill.supplierId}`,
          createdAt: now(),
        };
      });

      const newKhata =
        bill.paymentType === "udhaar"
          ? [
              ...st.khataTransactions,
              {
                id: uid(),
                partyType: "supplier" as PartyType,
                partyId: bill.supplierId,
                transactionType: "payable_incurred" as KhataTxnType,
                amount: bill.totalAmount,
                relatedPurchaseBillId: bill.id, // explicit FK (per resolution #6)
                transactionDate: now(),
                createdAt: now(),
              },
            ]
          : st.khataTransactions;

      const newSuppliers = st.suppliers.map((sp) =>
        sp.id === bill.supplierId
          ? { ...sp, payableBalance: computeBalance(newKhata, "supplier", sp.id), updatedAt: now() }
          : sp
      );

      return {
        purchaseBills: [bill, ...st.purchaseBills],
        items: newItems,
        inventoryMovements: [...newMovements, ...st.inventoryMovements],
        khataTransactions: newKhata,
        suppliers: newSuppliers,
        draftPurchase: { ...initialDraftPurchase },
      };
    });

    void createLocalPurchase({
      uuid: billUuid,
      supplierId: bill.supplierId,
      paymentType: bill.paymentType,
      amountPaid: bill.amountPaid,
      lines: bill.lines.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        qty: line.qtyInPurchasedUnit,
        unitCost: line.unitCost,
      })),
    }).catch((error) => console.error("Local purchase transaction failed", error));
    if (get().isOnline) get().pushBill(billUuid);
    return bill;
  },

  // Per resolution #2 — addItem now takes initialQtyInBaseUnit
  addItem: (data) => {
    
    const id = uid();
    const ts = now();
    const baseUnit: ItemUnit = {
      id: uid(),
      itemId: id,
      unitName: data.baseUnitName,
      conversionToBase: 1,
      isBaseUnit: true,
      createdAt: ts,
    };
    const extras: ItemUnit[] = (data.extraUnits || []).map((e) => ({
      id: uid(),
      itemId: id,
      unitName: e.unitName,
      conversionToBase: e.conversionToBase,
      isBaseUnit: false,
      createdAt: ts,
    }));
    const item: Item = {
      id,
      shopId: 1,
      categoryId: data.categoryId,
      name: data.name,
      urduName: data.urduName,
      skuCode: data.skuCode,
      brand: data.brand,
      specification: data.specification,
      notes: data.notes,
      icon: data.icon,
      photoUrl: data.photoUrl, // optional product image
      baseUnitName: data.baseUnitName,
      initialQtyInBaseUnit: data.initialQtyInBaseUnit,
      qtyInBaseUnit: data.initialQtyInBaseUnit, // current stock = opening stock at creation
      pricePerBaseUnit: data.pricePerBaseUnit,
      lowStockThreshold: data.lowStockThreshold,
      saleMode: data.saleMode ?? "QTY",
      fractionalPackAllowed: data.fractionalPackAllowed ?? false,
      isActive: true,
      units: [baseUnit, ...extras],
      createdAt: ts,
      updatedAt: ts,
    };

    // Per resolution #2 — if initial stock > 0, record an "initial" stock adjustment
    const adjustment: StockAdjustment | null =
      data.initialQtyInBaseUnit > 0
        ? {
            id: uid(),
            itemId: id,
            type: "initial" as AdjustmentType,
            deltaInBaseUnit: data.initialQtyInBaseUnit,
            newQtyInBaseUnit: data.initialQtyInBaseUnit,
            reason: "Opening stock at item creation",
            adjustedAt: ts,
          }
        : null;

    set((s) => ({
      items: [...s.items, item],
      stockAdjustments: adjustment ? [adjustment, ...s.stockAdjustments] : s.stockAdjustments,
    }));
    return item;
  },
  updateItem: (id, data) => {
    const s = get();
    const existing = s.items.find((i) => i.id === id);
    if (!existing) return;
    const oldPrice = existing.pricePerBaseUnit;
    const newPrice = data.pricePerBaseUnit ?? oldPrice;
    
    set((st) => {
      let newHistory = st.rateHistory;
      if (data.pricePerBaseUnit !== undefined && newPrice !== oldPrice) {
        newHistory = [
          { id: uid(), itemId: id, oldPrice, newPrice, changedAt: now() },
          ...st.rateHistory,
        ];
      }
      return {
        items: st.items.map((i) =>
          i.id === id
            ? {
                ...i,
                ...data,
                units: data.units ? data.units : i.units,
                updatedAt: now(),
              }
            : i
        ),
        rateHistory: newHistory,
      };
    });
  },
  // Per resolution #7 — deletion window configurable (default 90 days)
  softDeleteItem: (id) => {
    const s = get();
    const windowDays = s.shopConfig.itemDeletionWindowDays;
    const cutoff = Date.now() - windowDays * 86400000;
    const recentBill = s.saleBills.some(
      (b) => b.lines.some((l) => l.itemId === id) && new Date(b.billDate).getTime() > cutoff
    );
    if (recentBill) {
      return {
        ok: false,
        error: `Item is on a bill in the last ${windowDays} days`,
      };
    }
    
    set((st) => ({
      items: st.items.map((i) => (i.id === id ? { ...i, isActive: false, updatedAt: now() } : i)),
    }));
    return { ok: true };
  },

  // Per resolution #2 — new Stock Adjustment feature
  adjustStock: (itemId, type, deltaInBaseUnit, reason) => {
    
    const s = get();
    const item = s.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: "Item not found" };
    const newQty = round2(item.qtyInBaseUnit + deltaInBaseUnit);
    if (newQty < 0) {
      return {
        ok: false,
        error: `Cannot reduce below 0. Current stock: ${item.qtyInBaseUnit} ${item.baseUnitName}`,
      };
    }
    const adjustment: StockAdjustment = {
      id: uid(),
      itemId,
      type,
      deltaInBaseUnit,
      newQtyInBaseUnit: newQty,
      reason,
      adjustedAt: now(),
    };
    set((st) => {
      const newItems = st.items.map((it) =>
        it.id === itemId ? { ...it, qtyInBaseUnit: newQty, updatedAt: now() } : it
      );
      const newNotifs = [...st.notifications];
      // After adjustment, check low-stock
      const updated = newItems.find((i) => i.id === itemId)!;
      if (updated.qtyInBaseUnit <= updated.lowStockThreshold) {
        const exists = newNotifs.some(
          (n) => n.type === "low_stock" && n.relatedItemId === itemId && !n.isRead
        );
        if (!exists) {
          newNotifs.unshift({
            id: uid(),
            shopId: 1,
            type: "low_stock",
            message: `${updated.name} is low on stock (${updated.qtyInBaseUnit} ${updated.baseUnitName} left)`,
            relatedItemId: itemId,
            isRead: false,
            createdAt: now(),
          });
        }
      }

      const movement: InventoryMovement = {
        id: uid(),
        itemId,
        type: deltaInBaseUnit >= 0 ? "adjustment_pos" : "adjustment_neg",
        deltaInBaseUnit,
        newQtyInBaseUnit: newQty,
        referenceType: "adjustment",
        referenceId: adjustment.id,
        note: `Physical count adjustment (${type}): ${reason}`,
        createdAt: now(),
      };

      const audit: AuditLog = {
        id: uid(),
        action: "stock_adjustment",
        details: `Stock adjusted for item #${itemId} by ${deltaInBaseUnit} base units (${type}). Reason: ${reason}`,
        createdAt: now(),
      };

      return {
        stockAdjustments: [adjustment, ...st.stockAdjustments],
        inventoryMovements: [movement, ...st.inventoryMovements],
        auditLogs: [audit, ...st.auditLogs],
        items: newItems,
        notifications: newNotifs,
      };
    });
    return { ok: true, adjustment };
  },

  addCategory: (name, icon) => {
    
    const ts = now();
    const c: Category = {
      id: uid(),
      shopId: 1,
      name,
      icon,
      parentCategoryId: null,
      createdAt: ts,
      updatedAt: ts,
    };
    set((s) => ({ categories: [...s.categories, c] }));
    return c;
  },

  deleteCategory: (id) => {
    const s = get();
    const check = canDeleteCategory(s.items, id);
    if (!check.ok) return check;
    
    set((st) => ({ categories: st.categories.filter((c) => c.id !== id) }));
    return { ok: true };
  },

  addCustomer: (name, phone) => {
    
    const s = get();
    let warning: string | undefined;
    if (phone) {
      const exact = s.customers.find((c) => c.phone && c.phone === phone);
      if (exact) warning = `A customer with this phone already exists: ${exact.name}`;
    }
    const similar = s.customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (similar && !warning) warning = `A customer named "${similar.name}" already exists`;

    const ts = now();
    const customer: Customer = {
      id: uid(),
      shopId: 1,
      name,
      phone,
      khataBalance: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    set((st) => ({ customers: [...st.customers, customer] }));
    return { ok: true, customer, warning };
  },
  addSupplier: (name, phone) => {
    
    const s = get();
    let warning: string | undefined;
    if (phone) {
      const exact = s.suppliers.find((c) => c.phone && c.phone === phone);
      if (exact) warning = `A supplier with this phone already exists: ${exact.name}`;
    }
    const ts = now();
    const supplier: Supplier = {
      id: uid(),
      shopId: 1,
      name,
      phone,
      payableBalance: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    set((st) => ({ suppliers: [...st.suppliers, supplier] }));
    return { ok: true, supplier, warning };
  },
  recordCustomerPayment: (customerId, amount, note) => {
    
    set((st) => {
      const newTxns = [
        ...st.khataTransactions,
        {
          id: uid(),
          partyType: "customer" as PartyType,
          partyId: customerId,
          transactionType: "payment_received" as KhataTxnType,
          amount,
          note,
          transactionDate: now(),
          createdAt: now(),
        },
      ];
      return {
        khataTransactions: newTxns,
        customers: st.customers.map((c) =>
          c.id === customerId
            ? { ...c, khataBalance: computeBalance(newTxns, "customer", customerId), updatedAt: now() }
            : c
        ),
      };
    });
  },
  recordSupplierPayment: (supplierId, amount, note) => {
    
    set((st) => {
      const newTxns = [
        ...st.khataTransactions,
        {
          id: uid(),
          partyType: "supplier" as PartyType,
          partyId: supplierId,
          transactionType: "payment_made" as KhataTxnType,
          amount,
          note,
          transactionDate: now(),
          createdAt: now(),
        },
      ];
      return {
        khataTransactions: newTxns,
        suppliers: st.suppliers.map((sp) =>
          sp.id === supplierId
            ? { ...sp, payableBalance: computeBalance(newTxns, "supplier", supplierId), updatedAt: now() }
            : sp
        ),
      };
    });
  },

  recordReturn: (saleBillLineId, qtyReturnedInBaseUnit, reason, disposition) => {
    
    const s = get();
    const line = s.saleBills.flatMap((b) => b.lines).find((l) => l.id === saleBillLineId);
    if (!line) return { ok: false, error: "Original sale line not found" };

    const alreadyReturned = s.returns
      .filter((r) => r.saleBillLineId === saleBillLineId)
      .reduce((sum, r) => sum + r.qtyReturnedInBaseUnit, 0);
    const returnable = line.qtyInBaseUnit - alreadyReturned;
    if (qtyReturnedInBaseUnit > returnable) {
      return { ok: false, error: `Max returnable: ${returnable} base units` };
    }

    const refundAmount = round2(qtyReturnedInBaseUnit * line.unitPriceAtSale);
    const ts = now();
    const ret: Return = {
      id: uid(),
      saleBillLineId,
      qtyReturnedInBaseUnit,
      reason,
      disposition,
      refundAmount,
      returnDate: ts,
      createdAt: ts,
      updatedAt: ts,
    };

    const bill = s.saleBills.find((b) => b.id === line.saleBillId)!;
    set((st) => {
      const newItems =
        disposition === "back_to_sellable_stock"
          ? st.items.map((it) =>
              it.id === line.itemId
                ? {
                    ...it,
                    qtyInBaseUnit: round2(it.qtyInBaseUnit + qtyReturnedInBaseUnit),
                    updatedAt: now(),
                  }
                : it
            )
          : st.items;

      const newKhata =
        bill.paymentType === "udhaar" && bill.customerId
          ? [
              ...st.khataTransactions,
              {
                id: uid(),
                partyType: "customer" as PartyType,
                partyId: bill.customerId,
                transactionType: "payment_received" as KhataTxnType,
                amount: refundAmount,
                relatedReturnId: ret.id, // explicit FK (per resolution #6)
                note: "Return refund",
                transactionDate: now(),
                createdAt: now(),
              },
            ]
          : st.khataTransactions;

      const newCustomers = st.customers.map((c) =>
        c.id === bill.customerId
          ? { ...c, khataBalance: computeBalance(newKhata, "customer", c.id), updatedAt: now() }
          : c
      );

      const movement: InventoryMovement = {
        id: uid(),
        itemId: line.itemId,
        type: disposition === "back_to_sellable_stock" ? "customer_return" : "damage",
        deltaInBaseUnit: disposition === "back_to_sellable_stock" ? qtyReturnedInBaseUnit : 0,
        newQtyInBaseUnit: newItems.find((i) => i.id === line.itemId)?.qtyInBaseUnit ?? 0,
        referenceType: "return",
        referenceId: ret.id,
        note: `Customer return (${reason}): ${disposition === "back_to_sellable_stock" ? "restored to stock" : "damaged/written off"}`,
        createdAt: now(),
      };

      return {
        returns: [ret, ...st.returns],
        items: newItems,
        inventoryMovements: [movement, ...st.inventoryMovements],
        khataTransactions: newKhata,
        customers: newCustomers,
      };
    });
    return { ok: true, returnEntry: ret };
  },

  cancelSaleBill: (id, reason) => {
    
    const s = get();
    const bill = s.saleBills.find((b) => b.id === id);
    if (!bill) return { ok: false, error: "Bill not found" };
    if (bill.cancelled) return { ok: false, error: "Already cancelled" };

    // Check which lines have already been returned
    const lineReturnedMap = new Map<number, number>();
    for (const line of bill.lines) {
      const alreadyReturned = s.returns
        .filter((r) => r.saleBillLineId === line.id)
        .reduce((sum, r) => sum + r.qtyReturnedInBaseUnit, 0);
      lineReturnedMap.set(line.id, alreadyReturned);
    }

    set((st) => {
      const newItems = st.items.map((it) => {
        // Only restore unreturned quantities!
        const restored = bill.lines
          .filter((l) => l.itemId === it.id)
          .reduce((sum, l) => {
            const alreadyReturned = lineReturnedMap.get(l.id) || 0;
            const remainingToRestore = Math.max(0, l.qtyInBaseUnit - alreadyReturned);
            return sum + remainingToRestore;
          }, 0);
        if (restored === 0) return it;
        return { ...it, qtyInBaseUnit: round2(it.qtyInBaseUnit + restored), updatedAt: now() };
      });

      // Permanent inventory ledger entries for cancellation
      const cancelMovements: InventoryMovement[] = bill.lines.map((l) => {
        const alreadyReturned = lineReturnedMap.get(l.id) || 0;
        const restored = Math.max(0, l.qtyInBaseUnit - alreadyReturned);
        const it = newItems.find((i) => i.id === l.itemId)!;
        return {
          id: uid(),
          itemId: l.itemId,
          type: "cancellation" as const,
          deltaInBaseUnit: restored,
          newQtyInBaseUnit: it.qtyInBaseUnit,
          referenceType: "sale_bill" as const,
          referenceId: bill.id,
          note: `Restored from cancelled bill #${bill.id}: ${reason}`,
          createdAt: now(),
        };
      });

      const cancelAudit: AuditLog = {
        id: uid(),
        action: "cancellation",
        details: `Sale bill #${bill.id} cancelled. Reason: ${reason}`,
        createdAt: now(),
      };

      // Calculate already refunded amount to avoid double-crediting customer
      const alreadyRefundedAmount = bill.lines.reduce((sum, l) => {
        const returned = lineReturnedMap.get(l.id) || 0;
        return sum + (returned * l.unitPriceAtSale);
      }, 0);
      const remainingAmountToReverse = round2(Math.max(0, bill.totalAmount - alreadyRefundedAmount));

      let newKhata = st.khataTransactions;
      let newCustomers = st.customers;
      if (bill.paymentType === "udhaar" && bill.customerId && remainingAmountToReverse > 0) {
        newKhata = [
          ...st.khataTransactions,
          {
            id: uid(),
            partyType: "customer" as PartyType,
            partyId: bill.customerId,
            transactionType: "payment_received" as KhataTxnType,
            amount: remainingAmountToReverse,
            relatedSaleBillId: bill.id,
            note: `Reversal — bill cancelled: ${reason}${alreadyRefundedAmount > 0 ? ` (net of Rs. ${alreadyRefundedAmount} already returned)` : ""}`,
            transactionDate: now(),
            createdAt: now(),
          },
        ];
        newCustomers = st.customers.map((c) =>
          c.id === bill.customerId
            ? { ...c, khataBalance: computeBalance(newKhata, "customer", c.id), updatedAt: now() }
            : c
        );
      }

      return {
        saleBills: st.saleBills.map((b) =>
          b.id === id ? { ...b, cancelled: true, cancelReason: reason, updatedAt: now() } : b
        ),
        items: newItems,
        inventoryMovements: [...cancelMovements, ...st.inventoryMovements],
        auditLogs: [cancelAudit, ...st.auditLogs],
        khataTransactions: newKhata,
        customers: newCustomers,
      };
    });
    return { ok: true };
  },

  // Per resolution #4 — purchase cancel, with stock guard (no negative)
  cancelPurchaseBill: (id, reason) => {
    const s = get();
    const bill = s.purchaseBills.find((b) => b.id === id);
    if (!bill) return { ok: false, error: "Bill not found" };
    if (bill.cancelled) return { ok: false, error: "Already cancelled" };

    // Stock guard: if any item's current qty < what would be reversed, block
    for (const line of bill.lines) {
      const item = s.items.find((i) => i.id === line.itemId);
      if (!item) continue;
      if (item.qtyInBaseUnit < line.qtyInBaseUnit) {
        return {
          ok: false,
          error: `Cannot cancel: ${item.name} has only ${item.qtyInBaseUnit} ${item.baseUnitName} in stock, but ${line.qtyInBaseUnit} would need to be reversed (already sold further).`,
        };
      }
    }

    set((st) => {
      const newItems = st.items.map((it) => {
        const reversed = bill.lines
          .filter((l) => l.itemId === it.id)
          .reduce((sum, l) => sum + l.qtyInBaseUnit, 0);
        if (reversed === 0) return it;
        return { ...it, qtyInBaseUnit: round2(it.qtyInBaseUnit - reversed), updatedAt: now() };
      });

      let newKhata = st.khataTransactions;
      let newSuppliers = st.suppliers;
      if (bill.paymentType === "udhaar") {
        newKhata = [
          ...st.khataTransactions,
          {
            id: uid(),
            partyType: "supplier" as PartyType,
            partyId: bill.supplierId,
            transactionType: "payment_made" as KhataTxnType,
            amount: bill.totalAmount,
            relatedPurchaseBillId: bill.id,
            note: `Reversal — purchase cancelled: ${reason}`,
            transactionDate: now(),
            createdAt: now(),
          },
        ];
        newSuppliers = st.suppliers.map((sp) =>
          sp.id === bill.supplierId
            ? { ...sp, payableBalance: computeBalance(newKhata, "supplier", sp.id), updatedAt: now() }
            : sp
        );
      }

      return {
        purchaseBills: st.purchaseBills.map((b) =>
          b.id === id ? { ...b, cancelled: true, cancelReason: reason, updatedAt: now() } : b
        ),
        items: newItems,
        khataTransactions: newKhata,
        suppliers: newSuppliers,
      };
    });
    return { ok: true };
  },

  // Per resolution #1 — single canonical sync flow with UUID idempotency
  pendingSyncCount: () =>
    get().saleBills.filter((b) => b.syncStatus === "pending" || b.syncStatus === "failed").length +
    get().purchaseBills.filter((b) => b.syncStatus === "pending" || b.syncStatus === "failed").length,

  pushBill: (billUuid) => {
    const sale = get().saleBills.find((bill) => bill.uuid === billUuid);
    const purchase = get().purchaseBills.find((bill) => bill.uuid === billUuid);
    if (!sale && !purchase) return;
    set((st) => ({
      saleBills: st.saleBills.map((bill) => bill.uuid === billUuid ? { ...bill, syncStatus: "syncing" } : bill),
      purchaseBills: st.purchaseBills.map((bill) => bill.uuid === billUuid ? { ...bill, syncStatus: "syncing" } : bill),
    }));
    void fetch(sale ? "/api/sales" : "/api/purchases", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sale ? {
        uuid: sale.uuid, customerId: sale.customerId, paymentType: sale.paymentType,
        amountPaid: sale.amountPaid ?? (sale.paymentType === "cash" ? sale.totalAmount : 0),
        lines: sale.lines.map((line) => ({ itemId: line.itemId, unitId: line.unitId, qty: line.qtyInSoldUnit, unitPrice: line.negotiatedPrice ?? line.unitPriceAtSale, ...(line.isEstimatedWeight && line.ratePerKg ? { estimatedWeight: { ratePerKg: line.ratePerKg, saleAmount: line.lineTotal } } : {}) })),
      } : {
        uuid: purchase!.uuid, supplierId: purchase!.supplierId, paymentType: purchase!.paymentType,
        amountPaid: purchase!.amountPaid ?? (purchase!.paymentType === "cash" ? purchase!.totalAmount : 0),
        lines: purchase!.lines.map((line) => ({ itemId: line.itemId, unitId: line.unitId, qty: line.qtyInPurchasedUnit, unitCost: line.unitCost })),
      }),
    }).then((response) => {
      set((st) => ({
        saleBills: st.saleBills.map((bill) => bill.uuid === billUuid ? { ...bill, syncStatus: response.ok ? "synced" : "failed", updatedAt: now() } : bill),
        purchaseBills: st.purchaseBills.map((bill) => bill.uuid === billUuid ? { ...bill, syncStatus: response.ok ? "synced" : "failed", updatedAt: now() } : bill),
      }));
    }).catch(() => {
      set((st) => ({
        saleBills: st.saleBills.map((bill) => bill.uuid === billUuid ? { ...bill, syncStatus: "failed" } : bill),
        purchaseBills: st.purchaseBills.map((bill) => bill.uuid === billUuid ? { ...bill, syncStatus: "failed" } : bill),
      }));
    });
  },

  // Batch wrapper around pushBill — for offline queue (per resolution #1)
  pushSync: () => {
    const s = get();
    const pending = [
      ...s.saleBills.filter((b) => b.syncStatus === "pending" || b.syncStatus === "failed"),
      ...s.purchaseBills.filter((b) => b.syncStatus === "pending" || b.syncStatus === "failed"),
    ];
    pending.forEach((b) => get().pushBill(b.uuid));
  },

  markNotificationRead: (id) => {
    
    set((st) => ({
      notifications: st.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  },
  markAllNotificationsRead: () => {
    
    set((st) => ({
      notifications: st.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  },
  // Per resolution #7 — Khata reminder trigger rule
  triggerKhataReminders: () => {
    void generateLocalNotifications().catch((error) => console.error("Local notification generation failed", error));
    const s = get();
    const cfg = s.shopConfig;
    const nowMs = Date.now();
    const ageThresholdMs = cfg.khataReminderThresholdDays * 86400000;
    const newNotifs: AppNotification[] = [];

    for (const c of s.customers) {
      if (c.khataBalance < cfg.khataReminderThresholdAmount) continue;
      // Find oldest unpaid (udhaar) bill for this customer
      const custBills = s.saleBills
        .filter((b) => b.customerId === c.id && b.paymentType === "udhaar" && !b.cancelled)
        .sort((a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime());
      if (custBills.length === 0) continue;
      const oldest = custBills[0];
      const ageMs = nowMs - new Date(oldest.billDate).getTime();
      if (ageMs < ageThresholdMs) continue;
      // Check if reminder already exists
      const exists = s.notifications.some(
        (n) => n.type === "khata_reminder" && n.relatedCustomerId === c.id && !n.isRead
      );
      if (exists) continue;
      const daysOld = Math.floor(ageMs / 86400000);
      newNotifs.push({
        id: uid(),
        shopId: 1,
        type: "khata_reminder",
        message: `${c.name} owes Rs. ${Math.round(c.khataBalance).toLocaleString("en-PK")} (oldest bill ${daysOld} days old)`,
        relatedCustomerId: c.id,
        isRead: false,
        createdAt: now(),
      });
    }

    if (newNotifs.length > 0) {
      set((st) => ({ notifications: [...newNotifs, ...st.notifications] }));
    }
  },

  createAiSession: (rows, source) => {
    const ts = now();
    const id = uid();
    set((st) => ({
      aiSessions: [
        {
          id,
          shopId: 1,
          sourceType: source,
          rawExtracted: rows,
          status: "awaiting_review",
          createdAt: ts,
          updatedAt: ts,
        },
        ...st.aiSessions,
      ],
    }));
    return id;
  },
  // Per resolution #2 — confirm requires base_unit_name + low_stock_threshold
  confirmAiImport: (sessionId, rows) => {
    
    let added = 0;
    set((st) => {
      const ts = now();
      const newItems: Item[] = [];
      const newAdjustments: StockAdjustment[] = [];
      for (const r of rows) {
        const itemId = uid();
        const baseUnit: ItemUnit = {
          id: uid(),
          itemId,
          unitName: r.baseUnitName,
          conversionToBase: 1,
          isBaseUnit: true,
          createdAt: ts,
        };
        const item: Item = {
          id: itemId,
          shopId: 1,
          categoryId: r.categoryId,
          name: r.name,
          icon: "📦",
          baseUnitName: r.baseUnitName,
          initialQtyInBaseUnit: r.qty,
          qtyInBaseUnit: r.qty,
          pricePerBaseUnit: r.price,
          lowStockThreshold: r.lowStockThreshold,
          isActive: true,
          units: [baseUnit],
          createdAt: ts,
          updatedAt: ts,
        };
        newItems.push(item);
        if (r.qty > 0) {
          newAdjustments.push({
            id: uid(),
            itemId,
            type: "initial" as AdjustmentType,
            deltaInBaseUnit: r.qty,
            newQtyInBaseUnit: r.qty,
            reason: `AI Import session #${sessionId}`,
            adjustedAt: ts,
          });
        }
        added++;
      }
      return {
        items: [...st.items, ...newItems],
        stockAdjustments: [...newAdjustments, ...st.stockAdjustments],
        aiSessions: st.aiSessions.map((s) =>
          s.id === sessionId ? { ...s, status: "confirmed", updatedAt: ts } : s
        ),
      };
    });
    return added;
  },

  getItem: (id) => get().items.find((i) => i.id === id),
  getCategory: (id) => get().categories.find((c) => c.id === id),
  getCustomer: (id) => get().customers.find((c) => c.id === id),
  getSupplier: (id) => get().suppliers.find((sp) => sp.id === id),
  getUnit: (itemId, unitId) => {
    const it = get().items.find((i) => i.id === itemId);
    return it?.units.find((u) => u.id === unitId);
  },
  customerBalance: (customerId) =>
    computeBalance(get().khataTransactions, "customer", customerId),
  supplierBalance: (supplierId) =>
    computeBalance(get().khataTransactions, "supplier", supplierId),
    }),
);

if (typeof window !== "undefined") {
  let localWriteQueue = Promise.resolve();
  useApp.subscribe((state) => {
    localWriteQueue = localWriteQueue
      .then(() =>
        saveLocalSnapshot({
          shopConfig: state.shopConfig,
          categories: state.categories,
          items: state.items,
          customers: state.customers,
          suppliers: state.suppliers,
          saleBills: state.saleBills,
          purchaseBills: state.purchaseBills,
          returns: state.returns,
          khataTransactions: state.khataTransactions,
          notifications: state.notifications,
          rateHistory: state.rateHistory,
          aiSessions: state.aiSessions,
          stockAdjustments: state.stockAdjustments,
          categoryImages: state.categoryImages,
          inventoryMovements: state.inventoryMovements,
          auditLogs: state.auditLogs,
          attributes: state.attributes,
          attributeOptions: state.attributeOptions,
          payments: state.payments,
        })
      )
      .catch((error) => {
        console.error("Local database write failed", error);
      });
  });
  void useApp.getState().initializeLocalAuth();
  void fetch("/api/session", { credentials: "include" })
    .then((response) => response.json() as Promise<{ authenticated: boolean }>)
    .then((session) => {
      if (session.authenticated) return useApp.getState().hydrateFromServer();
      useApp.setState({ isAuthed: false });
      return false;
    })
    .catch(() => {
      useApp.setState({ isAuthed: false });
    });
}

// ============================================================
// Misc helpers (pure, exported separately)
// ============================================================

// Per resolution #5 — money rounding rule (2 decimals)
export const fmtRs = (n: number | undefined) => {
  const rounded = round2(n ?? 0);
  if (Number.isInteger(rounded)) {
    return "Rs. " + rounded.toLocaleString("en-PK");
  }
  return "Rs. " + rounded.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const diffMs = today.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "just now";
  if (diffH < 24 && today.getDate() === d.getDate()) {
    return d.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
  }
  if (diffH < 48) return "yesterday";
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
};

export const stockDisplay = (item: Item): string => {
  const total = item.qtyInBaseUnit;
  const sortedExtras = item.units
    .filter((u) => !u.isBaseUnit)
    .sort((a, b) => b.conversionToBase - a.conversionToBase);
  let remaining = total;
  const parts: string[] = [];
  for (const u of sortedExtras) {
    const n = Math.floor(remaining / u.conversionToBase);
    if (n > 0) {
      parts.push(`${n} ${u.unitName}`);
      remaining = round2(remaining - n * u.conversionToBase);
    }
  }
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining} ${item.baseUnitName}`);
  }
  return parts.join(" ");
};

export const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

// Sync status display helper (per resolution #1)
export const syncStatusBadge = (status: SyncStatus): { label: string; color: string } => {
  switch (status) {
    case "synced":
      return { label: "✓ Synced", color: "bg-emerald-100 text-emerald-700" };
    case "syncing":
      return { label: "⟳ Syncing…", color: "bg-blue-100 text-blue-700" };
    case "pending":
      return { label: "☁ Pending", color: "bg-amber-100 text-amber-700" };
    case "failed":
      return { label: "⚠ Failed", color: "bg-rose-100 text-rose-700" };
  }
};
