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
  PaymentType,
  ScreenId,
  NavParams,
  PartyType,
  KhataTxnType,
  ReturnReason,
  ReturnDisposition,
  AdjustmentType,
  SyncStatus,
} from "./types";
import {
  seedCategories,
  seedItems,
  seedCustomers,
  seedSuppliers,
  seedSaleBills,
  seedPurchaseBills,
  seedKhataTransactions,
  seedNotifications,
  seedRateHistory,
  seedAiImportSessions,
  seedShopConfig,
  seedStockAdjustments,
} from "./seed";

// ============================================================
// Store shape
// ============================================================

interface AppState {
  // Auth
  isAuthed: boolean;
  login: (pin: string) => boolean;

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
    }[];
  };
  draftSaleAddLine: (itemId: number, unitId: number, qty: number) => { ok: boolean; error?: string };
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
    categoryId: number;
    baseUnitName: string;
    pricePerBaseUnit: number;
    lowStockThreshold: number;
    icon: string;
    initialQtyInBaseUnit: number; // opening stock (per resolution #2)
    extraUnits?: { unitName: string; conversionToBase: number }[];
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

// Per resolution #1 — client-generated UUID for idempotency
const generateUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// Per resolution #5 — money rounding rule: round to 2 decimals
const round2 = (n: number) => Math.round(n * 100) / 100;

// Recompute customer/supplier balance from the ledger (cached on the entity)
const computeBalance = (
  txns: KhataTransaction[],
  partyType: PartyType,
  partyId: number
): number => {
  let bal = 0;
  for (const t of txns) {
    if (t.partyType !== partyType || t.partyId !== partyId) continue;
    if (t.transactionType === "credit_given" || t.transactionType === "payable_incurred") {
      bal += t.amount;
    } else {
      bal -= t.amount;
    }
  }
  return round2(bal);
};

// Convert sold/purchased qty to base
const toBase = (item: Item, unitId: number, qty: number): number => {
  const u = item.units.find((x) => x.id === unitId);
  if (!u) return qty;
  return round2(qty * u.conversionToBase);
};

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

export const useApp = create<AppState>((set, get) => ({
  isAuthed: false,
  login: (pin) => {
    if (pin === "1234" || pin === "") {
      set({ isAuthed: true });
      return true;
    }
    return false;
  },

  screen: "login",
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

  shopConfig: seedShopConfig,
  updateShopConfig: (patch) =>
    set((s) => ({ shopConfig: { ...s.shopConfig, ...patch } })),

  isOnline: true,
  // Per resolution #1 — when coming back online, auto-trigger push of all pending bills
  setOnline: (online) => {
    set({ isOnline: online });
    if (online) {
      // Use setTimeout so the state update commits first
      setTimeout(() => get().pushSync(), 100);
    }
  },

  categories: seedCategories,
  items: seedItems,
  customers: seedCustomers,
  suppliers: seedSuppliers,
  saleBills: seedSaleBills,
  purchaseBills: seedPurchaseBills,
  returns: [],
  khataTransactions: seedKhataTransactions,
  notifications: seedNotifications,
  rateHistory: seedRateHistory,
  aiSessions: seedAiImportSessions,
  stockAdjustments: seedStockAdjustments,

  draftSale: initialDraftSale,
  draftPurchase: initialDraftPurchase,

  draftSaleAddLine: (itemId, unitId, qty) => {
    const state = get();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: "Item not found" };
    const qtyBase = toBase(item, unitId, qty);
    if (qtyBase > item.qtyInBaseUnit) {
      const u = item.units.find((x) => x.id === unitId);
      const availSold = item.qtyInBaseUnit / (u?.conversionToBase || 1);
      return {
        ok: false,
        error: `Only ${Math.floor(availSold)} ${u?.unitName || item.baseUnitName} available`,
      };
    }
    const lineTotal = round2(qtyBase * item.pricePerBaseUnit);
    set((s) => ({
      draftSale: {
        ...s.draftSale,
        lines: [
          ...s.draftSale.lines,
          { tempId: tempId(), itemId, unitId, qty, lineTotal },
        ],
      },
    }));
    return { ok: true };
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
      // Per resolution #1: pending status until POST /sales succeeds
      syncStatus: "pending",
      createdAt: now(),
      updatedAt: now(),
      lines: s.draftSale.lines.map((l) => {
        const item = s.items.find((x) => x.id === l.itemId)!;
        const qtyBase = toBase(item, l.unitId, l.qty);
        return {
          id: uid(),
          saleBillId: billId,
          itemId: l.itemId,
          unitId: l.unitId,
          qtyInSoldUnit: l.qty,
          qtyInBaseUnit: qtyBase,
          unitPriceAtSale: item.pricePerBaseUnit,
          lineTotal: l.lineTotal,
          createdAt: now(),
        };
      }),
    };

    // Atomic update: deduct stock + add bill + khata entry + low-stock check
    set((st) => {
      const newItems = st.items.map((it) => {
        const deducted = bill.lines
          .filter((l) => l.itemId === it.id)
          .reduce((sum, l) => sum + l.qtyInBaseUnit, 0);
        if (deducted === 0) return it;
        return { ...it, qtyInBaseUnit: round2(it.qtyInBaseUnit - deducted), updatedAt: now() };
      });

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
                relatedSaleBillId: bill.id, // explicit FK (per resolution #6)
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
        khataTransactions: newKhata,
        customers: newCustomers,
        notifications: newNotifs,
        draftSale: { ...initialDraftSale },
      };
    });

    // Per resolution #1: immediately try POST /sales if online (single canonical flow)
    if (get().isOnline) {
      // Use setTimeout so UI updates first, then async push
      setTimeout(() => get().pushBill(billUuid), 200);
    }

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
        const newCost = bill.lines.find((l) => l.itemId === it.id)?.costPerBaseUnit;
        return {
          ...it,
          qtyInBaseUnit: round2(it.qtyInBaseUnit + added),
          costPerBaseUnit: newCost ?? it.costPerBaseUnit,
          updatedAt: now(),
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
        khataTransactions: newKhata,
        suppliers: newSuppliers,
        draftPurchase: { ...initialDraftPurchase },
      };
    });

    if (get().isOnline) {
      setTimeout(() => get().pushBill(billUuid), 200);
    }
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
      icon: data.icon,
      baseUnitName: data.baseUnitName,
      initialQtyInBaseUnit: data.initialQtyInBaseUnit,
      qtyInBaseUnit: data.initialQtyInBaseUnit, // current stock = opening stock at creation
      pricePerBaseUnit: data.pricePerBaseUnit,
      lowStockThreshold: data.lowStockThreshold,
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
      return {
        stockAdjustments: [adjustment, ...st.stockAdjustments],
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

      return {
        returns: [ret, ...st.returns],
        items: newItems,
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

    set((st) => {
      const newItems = st.items.map((it) => {
        const restored = bill.lines
          .filter((l) => l.itemId === it.id)
          .reduce((sum, l) => sum + l.qtyInBaseUnit, 0);
        if (restored === 0) return it;
        return { ...it, qtyInBaseUnit: round2(it.qtyInBaseUnit + restored), updatedAt: now() };
      });

      let newKhata = st.khataTransactions;
      let newCustomers = st.customers;
      if (bill.paymentType === "udhaar" && bill.customerId) {
        newKhata = [
          ...st.khataTransactions,
          {
            id: uid(),
            partyType: "customer" as PartyType,
            partyId: bill.customerId,
            transactionType: "payment_received" as KhataTxnType,
            amount: bill.totalAmount,
            relatedSaleBillId: bill.id,
            note: `Reversal — bill cancelled: ${reason}`,
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

  // pushBill — pushes a single bill by UUID. Server-side idempotency:
  // if a bill with this UUID already exists, server returns 200 OK with the existing record
  // (we model this by always marking synced on success).
  pushBill: (billUuid) => {
    set((st) => {
      // Mark as syncing first (UI feedback)
      const markSyncing = (b: SaleBill | PurchaseBill): SaleBill | PurchaseBill =>
        b.uuid === billUuid && (b.syncStatus === "pending" || b.syncStatus === "failed")
          ? { ...b, syncStatus: "syncing" as SyncStatus }
          : b;
      return {
        saleBills: st.saleBills.map(markSyncing),
        purchaseBills: st.purchaseBills.map(markSyncing),
      };
    });

    // Simulate network round-trip — POST /sales or POST /purchases
    // Server checks UUID for idempotency. If UUID exists, returns existing record (no duplicate).
    setTimeout(() => {
      set((st) => {
        const markSynced = (b: SaleBill | PurchaseBill): SaleBill | PurchaseBill =>
          b.uuid === billUuid && b.syncStatus === "syncing"
            ? { ...b, syncStatus: "synced" as SyncStatus, updatedAt: now() }
            : b;
        return {
          saleBills: st.saleBills.map(markSynced),
          purchaseBills: st.purchaseBills.map(markSynced),
        };
      });
    }, 800); // simulate network latency
  },

  // Batch wrapper around pushBill — for offline queue (per resolution #1)
  pushSync: () => {
    const s = get();
    const pending = [
      ...s.saleBills.filter((b) => b.syncStatus === "pending" || b.syncStatus === "failed"),
      ...s.purchaseBills.filter((b) => b.syncStatus === "pending" || b.syncStatus === "failed"),
    ];
    pending.forEach((b, i) => {
      // Stagger pushes so they don't all hit the server at once
      setTimeout(() => get().pushBill(b.uuid), i * 300);
    });
  },

  markNotificationRead: (id) =>
    set((st) => ({
      notifications: st.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    })),
  markAllNotificationsRead: () =>
    set((st) => ({
      notifications: st.notifications.map((n) => ({ ...n, isRead: true })),
    })),
  // Per resolution #7 — Khata reminder trigger rule
  triggerKhataReminders: () => {
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
}));

// ============================================================
// Misc helpers (pure, exported separately)
// ============================================================

// Per resolution #5 — money rounding rule (2 decimals)
export const fmtRs = (n: number) => {
  const rounded = round2(n);
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
