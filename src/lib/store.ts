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
  PaymentType,
  ScreenId,
  NavParams,
  PartyType,
  KhataTxnType,
  ReturnReason,
  ReturnDisposition,
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

  // Data
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

  // Sale draft (used by sale-new screen — kept here so it survives navigations)
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
      unitCost: number;
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
    qtyInBaseUnit: number;
    extraUnits?: { unitName: string; conversionToBase: number }[];
  }) => Item;
  updateItem: (id: number, data: Partial<Item>) => void;
  softDeleteItem: (id: number) => { ok: boolean; error?: string };
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

  // Bill cancellation
  cancelSaleBill: (id: number, reason: string) => void;

  // Sync
  pendingSyncCount: () => number;
  pushSync: () => void;

  // Notifications
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;

  // AI Import
  createAiSession: (rows: { name: string; price: number }[], source: "photo" | "pdf") => number;
  confirmAiImport: (sessionId: number, rows: { name: string; price: number; qty: number; categoryId: number }[]) => number;

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

// Recompute customer/supplier balance from the ledger
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
  return Math.round(bal * 100) / 100;
};

// Convert sold/purchased qty to base
const toBase = (item: Item, unitId: number, qty: number): number => {
  const u = item.units.find((x) => x.id === unitId);
  if (!u) return qty;
  return Math.round(qty * u.conversionToBase * 1000) / 1000;
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
    const lineTotal = Math.round(qtyBase * item.pricePerBaseUnit * 100) / 100;
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
    const total = s.draftSale.lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const billId = uid();
    const bill: SaleBill = {
      id: billId,
      shopId: 1,
      customerId: s.draftSale.customerId,
      billDate: now(),
      paymentType: s.draftSale.paymentType,
      totalAmount: Math.round(total * 100) / 100,
      syncStatus: "pending",
      lines: s.draftSale.lines.map((l, i) => {
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
        return { ...it, qtyInBaseUnit: Math.round((it.qtyInBaseUnit - deducted) * 1000) / 1000 };
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
                relatedBillId: bill.id,
                transactionDate: now(),
              },
            ]
          : st.khataTransactions;

      const newCustomers = st.customers.map((c) =>
        c.id === bill.customerId
          ? { ...c, khataBalance: computeBalance(newKhata, "customer", c.id) }
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
    return bill;
  },

  draftPurchaseAddLine: (itemId, unitId, qty, unitCost) => {
    const state = get();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    const qtyBase = toBase(item, unitId, qty);
    const lineTotal = Math.round(qtyBase * unitCost * 100) / 100;
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
    const total = s.draftPurchase.lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const billId = uid();
    const bill: PurchaseBill = {
      id: billId,
      shopId: 1,
      supplierId: s.draftPurchase.supplierId!,
      billDate: now(),
      paymentType: s.draftPurchase.paymentType,
      totalAmount: Math.round(total * 100) / 100,
      syncStatus: "pending",
      lines: s.draftPurchase.lines.map((l) => {
        const item = s.items.find((x) => x.id === l.itemId)!;
        const qtyBase = toBase(item, l.unitId, l.qty);
        return {
          id: uid(),
          purchaseBillId: billId,
          itemId: l.itemId,
          unitId: l.unitId,
          qtyInPurchasedUnit: l.qty,
          qtyInBaseUnit: qtyBase,
          unitCost: l.unitCost,
          lineTotal: l.lineTotal,
        };
      }),
    };

    set((st) => {
      const newItems = st.items.map((it) => {
        const added = bill.lines
          .filter((l) => l.itemId === it.id)
          .reduce((sum, l) => sum + l.qtyInBaseUnit, 0);
        if (added === 0) return it;
        const newCost = bill.lines.find((l) => l.itemId === it.id)?.unitCost ?? it.costPerBaseUnit;
        return {
          ...it,
          qtyInBaseUnit: Math.round((it.qtyInBaseUnit + added) * 1000) / 1000,
          costPerBaseUnit: newCost,
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
                relatedBillId: bill.id,
                transactionDate: now(),
              },
            ]
          : st.khataTransactions;

      const newSuppliers = st.suppliers.map((sp) =>
        sp.id === bill.supplierId
          ? { ...sp, payableBalance: computeBalance(newKhata, "supplier", sp.id) }
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
    return bill;
  },

  addItem: (data) => {
    const id = uid();
    const baseUnit: ItemUnit = {
      id: uid(),
      itemId: id,
      unitName: data.baseUnitName,
      conversionToBase: 1,
      isBaseUnit: true,
    };
    const extras: ItemUnit[] = (data.extraUnits || []).map((e) => ({
      id: uid(),
      itemId: id,
      unitName: e.unitName,
      conversionToBase: e.conversionToBase,
      isBaseUnit: false,
    }));
    const item: Item = {
      id,
      shopId: 1,
      categoryId: data.categoryId,
      name: data.name,
      icon: data.icon,
      baseUnitName: data.baseUnitName,
      qtyInBaseUnit: data.qtyInBaseUnit,
      pricePerBaseUnit: data.pricePerBaseUnit,
      lowStockThreshold: data.lowStockThreshold,
      isActive: true,
      units: [baseUnit, ...extras],
    };
    set((s) => ({ items: [...s.items, item] }));
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
              }
            : i
        ),
        rateHistory: newHistory,
      };
    });
  },
  softDeleteItem: (id) => {
    const s = get();
    const recentBill = s.saleBills.some(
      (b) => b.lines.some((l) => l.itemId === id) && Date.now() - new Date(b.billDate).getTime() < 30 * 86400000
    );
    if (recentBill) return { ok: false, error: "Item is on a bill in the last 30 days" };
    set((st) => ({
      items: st.items.map((i) => (i.id === id ? { ...i, isActive: false } : i)),
    }));
    return { ok: true };
  },
  addCategory: (name, icon) => {
    const c: Category = {
      id: uid(),
      shopId: 1,
      name,
      icon,
      parentCategoryId: null,
    };
    set((s) => ({ categories: [...s.categories, c] }));
    return c;
  },

  addCustomer: (name, phone) => {
    const s = get();
    // Duplicate detection
    let warning: string | undefined;
    if (phone) {
      const exact = s.customers.find((c) => c.phone && c.phone === phone);
      if (exact) warning = `A customer with this phone already exists: ${exact.name}`;
    }
    const similar = s.customers.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (similar && !warning) warning = `A customer named "${similar.name}" already exists`;

    const customer: Customer = {
      id: uid(),
      shopId: 1,
      name,
      phone,
      khataBalance: 0,
      createdAt: now(),
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
    const supplier: Supplier = {
      id: uid(),
      shopId: 1,
      name,
      phone,
      payableBalance: 0,
      createdAt: now(),
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
        },
      ];
      return {
        khataTransactions: newTxns,
        customers: st.customers.map((c) =>
          c.id === customerId
            ? { ...c, khataBalance: computeBalance(newTxns, "customer", customerId) }
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
        },
      ];
      return {
        khataTransactions: newTxns,
        suppliers: st.suppliers.map((sp) =>
          sp.id === supplierId
            ? { ...sp, payableBalance: computeBalance(newTxns, "supplier", supplierId) }
            : sp
        ),
      };
    });
  },

  recordReturn: (saleBillLineId, qtyReturnedInBaseUnit, reason, disposition) => {
    const s = get();
    const line = s.saleBills
      .flatMap((b) => b.lines)
      .find((l) => l.id === saleBillLineId);
    if (!line) return { ok: false, error: "Original sale line not found" };

    // Already returned against this line?
    const alreadyReturned = s.returns
      .filter((r) => r.saleBillLineId === saleBillLineId)
      .reduce((sum, r) => sum + r.qtyReturnedInBaseUnit, 0);
    const returnable = line.qtyInBaseUnit - alreadyReturned;
    if (qtyReturnedInBaseUnit > returnable) {
      return { ok: false, error: `Max returnable: ${returnable} base units` };
    }

    const refundAmount =
      Math.round(qtyReturnedInBaseUnit * line.unitPriceAtSale * 100) / 100;
    const ret: Return = {
      id: uid(),
      saleBillLineId,
      qtyReturnedInBaseUnit,
      reason,
      disposition,
      refundAmount,
      returnDate: now(),
    };

    const bill = s.saleBills.find((b) => b.id === line.saleBillId)!;
    set((st) => {
      const newItems =
        disposition === "back_to_sellable_stock"
          ? st.items.map((it) =>
              it.id === line.itemId
                ? {
                    ...it,
                    qtyInBaseUnit:
                      Math.round((it.qtyInBaseUnit + qtyReturnedInBaseUnit) * 1000) / 1000,
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
                relatedBillId: bill.id,
                note: `Return refund`,
                transactionDate: now(),
              },
            ]
          : st.khataTransactions;

      const newCustomers = st.customers.map((c) =>
        c.id === bill.customerId
          ? { ...c, khataBalance: computeBalance(newKhata, "customer", c.id) }
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
    if (!bill || bill.cancelled) return;
    set((st) => {
      // Restore stock
      const newItems = st.items.map((it) => {
        const restored = bill.lines
          .filter((l) => l.itemId === it.id)
          .reduce((sum, l) => sum + l.qtyInBaseUnit, 0);
        if (restored === 0) return it;
        return { ...it, qtyInBaseUnit: Math.round((it.qtyInBaseUnit + restored) * 1000) / 1000 };
      });

      // Reverse khata if it was udhaar
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
            relatedBillId: bill.id,
            note: `Reversal — bill cancelled: ${reason}`,
            transactionDate: now(),
          },
        ];
        newCustomers = st.customers.map((c) =>
          c.id === bill.customerId
            ? { ...c, khataBalance: computeBalance(newKhata, "customer", c.id) }
            : c
        );
      }

      return {
        saleBills: st.saleBills.map((b) =>
          b.id === id ? { ...b, cancelled: true, cancelReason: reason } : b
        ),
        items: newItems,
        khataTransactions: newKhata,
        customers: newCustomers,
      };
    });
  },

  pendingSyncCount: () =>
    get().saleBills.filter((b) => b.syncStatus === "pending").length +
    get().purchaseBills.filter((b) => b.syncStatus === "pending").length,

  pushSync: () => {
    set((st) => ({
      saleBills: st.saleBills.map((b) =>
        b.syncStatus === "pending" ? { ...b, syncStatus: "synced" } : b
      ),
      purchaseBills: st.purchaseBills.map((b) =>
        b.syncStatus === "pending" ? { ...b, syncStatus: "synced" } : b
      ),
    }));
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

  createAiSession: (rows, source) => {
    const id = uid();
    set((st) => ({
      aiSessions: [
        {
          id,
          sourceType: source,
          rawExtracted: rows,
          status: "awaiting_review",
          createdAt: now(),
        },
        ...st.aiSessions,
      ],
    }));
    return id;
  },
  confirmAiImport: (sessionId, rows) => {
    let added = 0;
    set((st) => {
      const newItems: Item[] = [];
      for (const r of rows) {
        const baseUnit = "Piece";
        const item: Item = {
          id: uid(),
          shopId: 1,
          categoryId: r.categoryId,
          name: r.name,
          icon: "📦",
          baseUnitName: baseUnit,
          qtyInBaseUnit: r.qty,
          pricePerBaseUnit: r.price,
          lowStockThreshold: 10,
          isActive: true,
          units: [
            {
              id: uid(),
              itemId: 0, // placeholder, fixed below
              unitName: baseUnit,
              conversionToBase: 1,
              isBaseUnit: true,
            },
          ],
        };
        // Fix the unit's itemId to the actual id (can't loop easily, so patch)
        item.units[0].itemId = item.id;
        newItems.push(item);
        added++;
      }
      return {
        items: [...st.items, ...newItems],
        aiSessions: st.aiSessions.map((s) =>
          s.id === sessionId ? { ...s, status: "confirmed" } : s
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

export const fmtRs = (n: number) => {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) {
    return "Rs. " + rounded.toLocaleString("en-PK");
  }
  // Show with up to 2 decimals (e.g. Rs. 3.50, Rs. 17.5)
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

// Show stock in most-sensible unit combo: "2 Box 7 Piece"
export const stockDisplay = (item: Item): string => {
  const total = item.qtyInBaseUnit;
  // Find the largest non-base unit
  const sortedExtras = item.units
    .filter((u) => !u.isBaseUnit)
    .sort((a, b) => b.conversionToBase - a.conversionToBase);
  let remaining = total;
  const parts: string[] = [];
  for (const u of sortedExtras) {
    const n = Math.floor(remaining / u.conversionToBase);
    if (n > 0) {
      parts.push(`${n} ${u.unitName}`);
      remaining = Math.round((remaining - n * u.conversionToBase) * 1000) / 1000;
    }
  }
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining} ${item.baseUnitName}`);
  }
  return parts.join(" ");
};

export const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
