import {
  Category,
  Item,
  ItemUnit,
  Customer,
  Supplier,
  SaleBill,
  PurchaseBill,
  KhataTransaction,
  AppNotification,
  RateHistoryEntry,
  AiImportSession,
  ShopConfig,
  StockAdjustment,
  CategoryImage,
} from "./types";

// ============================================================
// Seed data — represents a small hardware shop's first state
// Schema compliant: top-level tables have shop_id + created_at + updated_at
//                  child tables have only created_at
// ============================================================

const now = () => new Date().toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 60 * 60 * 1000).toISOString();

// Per resolution #7: configurable shop settings
export const seedShopConfig: ShopConfig = {
  shopId: 1,
  shopName: "Hardware Shop",
  itemDeletionWindowDays: 90,
  lowStockThresholdDefault: 10,
  baseUnitDefault: "Piece",
  khataReminderThresholdDays: 7,
  khataReminderThresholdAmount: 1000,
};

export const seedCategories: Category[] = [
  { id: 1, shopId: 1, name: "Nails", urduName: "کیل", icon: "/images/icons/icon-nail.svg", parentCategoryId: null, defaultImageUrl: "/images/products/steel-nail.svg", imageUrl: "/images/products/steel-nail.svg", createdAt: daysAgo(60), updatedAt: daysAgo(60) },
  { id: 2, shopId: 1, name: "Screws", urduName: "پیچ", icon: "/images/icons/icon-screw.svg", parentCategoryId: null, defaultImageUrl: "/images/products/wood-screw.svg", imageUrl: "/images/products/wood-screw.svg", createdAt: daysAgo(60), updatedAt: daysAgo(60) },
  { id: 3, shopId: 1, name: "Locks", urduName: "تالے", icon: "/images/icons/icon-lock.svg", parentCategoryId: null, defaultImageUrl: "/images/products/padlock.svg", imageUrl: "/images/products/padlock.svg", createdAt: daysAgo(60), updatedAt: daysAgo(60) },
  { id: 4, shopId: 1, name: "Hinges", urduName: "قبضے", icon: "/images/icons/icon-hinge.svg", parentCategoryId: null, defaultImageUrl: "/images/products/door-hinge.svg", imageUrl: "/images/products/door-hinge.svg", createdAt: daysAgo(60), updatedAt: daysAgo(60) },
  { id: 5, shopId: 1, name: "Bolts", urduName: "بولٹ", icon: "/images/icons/icon-bolt.svg", parentCategoryId: null, defaultImageUrl: "/images/products/m8-bolt.svg", imageUrl: "/images/products/m8-bolt.svg", createdAt: daysAgo(60), updatedAt: daysAgo(60) },
  { id: 6, shopId: 1, name: "Nuts", urduName: "نٹ", icon: "/images/icons/icon-nut.svg", parentCategoryId: null, defaultImageUrl: "/images/products/m8-nut.svg", imageUrl: "/images/products/m8-nut.svg", createdAt: daysAgo(60), updatedAt: daysAgo(60) },
  { id: 7, shopId: 1, name: "Tools", urduName: "اوزار", icon: "/images/icons/icon-hammer.svg", parentCategoryId: null, defaultImageUrl: "/images/products/hammer.svg", imageUrl: "/images/products/hammer.svg", createdAt: daysAgo(60), updatedAt: daysAgo(60) },
  { id: 8, shopId: 1, name: "Paint", urduName: "رنگ", icon: "/images/icons/icon-paint.svg", parentCategoryId: null, defaultImageUrl: "/images/products/white-paint.svg", imageUrl: "/images/products/white-paint.svg", createdAt: daysAgo(60), updatedAt: daysAgo(60) },
];

// Category image library — pre-seeded with our dedicated product photos
export const seedCategoryImages: CategoryImage[] = [
  { id: 1, categoryId: 1, url: "/images/products/steel-nail.svg", isDefault: true, createdAt: daysAgo(60) },
  { id: 2, categoryId: 2, url: "/images/products/wood-screw.svg", isDefault: true, createdAt: daysAgo(60) },
  { id: 3, categoryId: 3, url: "/images/products/padlock.svg", isDefault: true, createdAt: daysAgo(60) },
  { id: 4, categoryId: 4, url: "/images/products/door-hinge.svg", isDefault: true, createdAt: daysAgo(60) },
  { id: 5, categoryId: 5, url: "/images/products/m8-bolt.svg", isDefault: true, createdAt: daysAgo(60) },
  { id: 6, categoryId: 6, url: "/images/products/m8-nut.svg", isDefault: true, createdAt: daysAgo(60) },
  { id: 7, categoryId: 7, url: "/images/products/hammer.svg", isDefault: true, createdAt: daysAgo(60) },
  { id: 8, categoryId: 8, url: "/images/products/white-paint.svg", isDefault: true, createdAt: daysAgo(60) },
];

let unitIdCounter = 1000;
const makeUnits = (baseName: string, extras: { name: string; conv: number }[] = []): ItemUnit[] => {
  const ts = daysAgo(60);
  const units = [
    { id: unitIdCounter++, itemId: 0, unitName: baseName, conversionToBase: 1, isBaseUnit: true, createdAt: ts },
    ...extras.map((e) => ({
      id: unitIdCounter++,
      itemId: 0,
      unitName: e.name,
      conversionToBase: e.conv,
      isBaseUnit: false,
      createdAt: ts,
    })),
  ];
  return units;
};

// Item factory — adds initialQtyInBaseUnit and photoUrl
const item = (
  id: number, categoryId: number, name: string, urduName: string, icon: string,
  baseUnitName: string, qtyInBaseUnit: number, initialQtyInBaseUnit: number,
  pricePerBaseUnit: number, costPerBaseUnit: number, lowStockThreshold: number,
  extras: { name: string; conv: number }[] = [],
  photoUrl?: string
): Item => ({
  id, shopId: 1, categoryId, name, urduName, icon, photoUrl,
  baseUnitName, qtyInBaseUnit, initialQtyInBaseUnit,
  pricePerBaseUnit, costPerBaseUnit, lowStockThreshold,
  isActive: true,
  units: makeUnits(baseUnitName, extras).map(u => ({ ...u, itemId: id })),
  createdAt: daysAgo(60), updatedAt: daysAgo(1),
});

export const seedItems: Item[] = [
  item(1, 1, "Steel Nail", "اسٹیل کیل", "/images/icons/icon-nail.svg", "Piece", 350, 400, 5, 3, 100, [{ name: "Box", conv: 12 }, { name: "Kg", conv: 50 }], "/images/products/steel-nail.svg"),
  item(2, 1, "Wall Nail", "دیوار کیل", "/images/icons/icon-nail.svg", "Piece", 60, 100, 3, 1.5, 80, [{ name: "Box", conv: 25 }], "/images/products/steel-nail.svg"),
  item(3, 1, "Concrete Nail", "کنکریٹ کیل", "/images/icons/icon-nail.svg", "Piece", 200, 200, 4, 2, 50, [{ name: "Box", conv: 20 }], "/images/products/steel-nail.svg"),
  item(4, 2, "Wood Screw", "لکڑی پیچ", "/images/icons/icon-screw.svg", "Piece", 180, 200, 6, 3.5, 60, [{ name: "Box", conv: 20 }], "/images/products/wood-screw.svg"),
  item(5, 2, "Wall Screw", "دیوار پیچ", "/images/icons/icon-screw.svg", "Piece", 45, 100, 8, 4, 50, [{ name: "Box", conv: 15 }], "/images/products/wood-screw.svg"),
  item(6, 3, "Door Lock 60mm", "دروازہ تالا", "/images/icons/icon-lock.svg", "Piece", 25, 30, 350, 220, 10, [], "/images/products/padlock.svg"),
  item(7, 3, "Padlock 50mm", "پیڈلاک", "/images/icons/icon-lock.svg", "Piece", 18, 25, 280, 180, 8, [], "/images/products/padlock.svg"),
  item(8, 3, "Cabinet Lock", "الاماری تالا", "/images/icons/icon-lock.svg", "Piece", 5, 15, 180, 120, 6, [], "/images/products/padlock.svg"),
  item(9, 4, "Door Hinge 4in", "دروازہ قبضہ", "/images/icons/icon-hinge.svg", "Pair", 40, 60, 95, 60, 15, [{ name: "Dozen", conv: 12 }], "/images/products/door-hinge.svg"),
  item(10, 4, "Cabinet Hinge 2in", "الماری قبضہ", "/images/icons/icon-hinge.svg", "Pair", 120, 144, 35, 22, 30, [{ name: "Dozen", conv: 12 }], "/images/products/door-hinge.svg"),
  item(11, 5, "M8 Bolt", "ایم 8 بولٹ", "/images/icons/icon-bolt.svg", "Piece", 280, 350, 12, 7, 100, [{ name: "Box", conv: 50 }], "/images/products/m8-bolt.svg"),
  item(12, 5, "M10 Bolt", "ایم 10 بولٹ", "/images/icons/icon-bolt.svg", "Piece", 75, 150, 18, 10, 80, [{ name: "Box", conv: 50 }], "/images/products/m8-bolt.svg"),
  item(13, 6, "M8 Nut", "ایم 8 نٹ", "/images/icons/icon-nut.svg", "Piece", 500, 600, 4, 2, 150, [{ name: "Box", conv: 100 }], "/images/products/m8-nut.svg"),
  item(14, 6, "M10 Lock Nut", "ایم 10 لاک نٹ", "/images/icons/icon-nut.svg", "Piece", 320, 400, 6, 3, 100, [{ name: "Box", conv: 100 }], "/images/products/m8-nut.svg"),
  item(15, 7, "Hammer", "ہتھوڑا", "/images/icons/icon-hammer.svg", "Piece", 12, 15, 450, 320, 5, [], "/images/products/hammer.svg"),
  item(16, 7, "Screwdriver Set", "اسکرو ڈرائیور", "/images/icons/icon-hammer.svg", "Set", 8, 10, 600, 420, 4, [], "/images/products/screwdriver-set.svg"),
  item(17, 8, "White Paint 4L", "سفید رنگ", "/images/icons/icon-paint.svg", "Tin", 20, 25, 1200, 920, 8, [], "/images/products/white-paint.svg"),
  item(18, 8, "Primer 1L", "پرائمری", "/images/icons/icon-paint.svg", "Tin", 14, 20, 480, 320, 6, [], "/images/products/white-paint.svg"),
];

export const seedCustomers: Customer[] = [
  { id: 1, shopId: 1, name: "Walk-in Customer", phone: undefined, khataBalance: 0, createdAt: daysAgo(60), updatedAt: daysAgo(60) },
  { id: 2, shopId: 1, name: "Rashid Khan", phone: "0301-2345678", khataBalance: 2400, createdAt: daysAgo(45), updatedAt: hoursAgo(2) },
  { id: 3, shopId: 1, name: "Imran Construction", phone: "0321-9876543", khataBalance: 8750, createdAt: daysAgo(30), updatedAt: daysAgo(12) },
  { id: 4, shopId: 1, name: "Bilal Ahmad", phone: "0333-1122334", khataBalance: 0, createdAt: daysAgo(20), updatedAt: daysAgo(20) },
  { id: 5, shopId: 1, name: "Salim Builder", phone: "0345-5566778", khataBalance: 3300, createdAt: daysAgo(15), updatedAt: daysAgo(1) },
];

export const seedSuppliers: Supplier[] = [
  { id: 1, shopId: 1, name: "Pak Steel Traders", phone: "042-111-222", payableBalance: 12500, createdAt: daysAgo(60), updatedAt: daysAgo(7) },
  { id: 2, shopId: 1, name: "Lahore Hardware Co.", phone: "042-333-444", payableBalance: 0, createdAt: daysAgo(40), updatedAt: daysAgo(40) },
  { id: 3, shopId: 1, name: "Fastener World", phone: "042-555-666", payableBalance: 774, createdAt: daysAgo(25), updatedAt: daysAgo(3) },
];

// Helper to generate UUID (client-side, per resolution #1)
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// Sale bills: a few recent ones, some pending sync (offline-created)
// All bills have client-generated UUID for idempotency (per resolution #1)
export const seedSaleBills: SaleBill[] = [
  {
    id: 1, uuid: "sale-0001-aaaa-bbbb-cccc0001", shopId: 1, customerId: 2, billDate: hoursAgo(2),
    paymentType: "udhaar", totalAmount: 1240, syncStatus: "synced",
    createdAt: hoursAgo(2), updatedAt: hoursAgo(2),
    lines: [
      { id: 1, saleBillId: 1, itemId: 1, unitId: 1000, qtyInSoldUnit: 48, qtyInBaseUnit: 48, unitPriceAtSale: 5, lineTotal: 240, createdAt: hoursAgo(2) },
      { id: 2, saleBillId: 1, itemId: 11, unitId: 1018, qtyInSoldUnit: 20, qtyInBaseUnit: 20, unitPriceAtSale: 12, lineTotal: 240, createdAt: hoursAgo(2) },
      { id: 3, saleBillId: 1, itemId: 4, unitId: 1007, qtyInSoldUnit: 30, qtyInBaseUnit: 30, unitPriceAtSale: 6, lineTotal: 180, createdAt: hoursAgo(2) },
      { id: 4, saleBillId: 1, itemId: 13, unitId: 1022, qtyInSoldUnit: 50, qtyInBaseUnit: 50, unitPriceAtSale: 4, lineTotal: 200, createdAt: hoursAgo(2) },
      { id: 5, saleBillId: 1, itemId: 9, unitId: 1014, qtyInSoldUnit: 4, qtyInBaseUnit: 4, unitPriceAtSale: 95, lineTotal: 380, createdAt: hoursAgo(2) },
    ],
  },
  {
    id: 2, uuid: "sale-0002-aaaa-bbbb-cccc0002", shopId: 1, customerId: null, billDate: hoursAgo(5),
    paymentType: "cash", totalAmount: 980, syncStatus: "synced",
    createdAt: hoursAgo(5), updatedAt: hoursAgo(5),
    lines: [
      { id: 6, saleBillId: 2, itemId: 6, unitId: 1011, qtyInSoldUnit: 2, qtyInBaseUnit: 2, unitPriceAtSale: 350, lineTotal: 700, createdAt: hoursAgo(5) },
      { id: 7, saleBillId: 2, itemId: 7, unitId: 1012, qtyInSoldUnit: 1, qtyInBaseUnit: 1, unitPriceAtSale: 280, lineTotal: 280, createdAt: hoursAgo(5) },
    ],
  },
  {
    id: 3, uuid: "sale-0003-aaaa-bbbb-cccc0003", shopId: 1, customerId: 5, billDate: daysAgo(1),
    paymentType: "udhaar", totalAmount: 3550, syncStatus: "synced",
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
    lines: [
      { id: 8, saleBillId: 3, itemId: 17, unitId: 1028, qtyInSoldUnit: 2, qtyInBaseUnit: 2, unitPriceAtSale: 1200, lineTotal: 2400, createdAt: daysAgo(1) },
      { id: 9, saleBillId: 3, itemId: 9, unitId: 1014, qtyInSoldUnit: 12, qtyInBaseUnit: 12, unitPriceAtSale: 95, lineTotal: 1140, createdAt: daysAgo(1) },
    ],
  },
  {
    id: 4, uuid: "sale-0004-aaaa-bbbb-cccc0004", shopId: 1, customerId: null, billDate: hoursAgo(1),
    paymentType: "cash", totalAmount: 540, syncStatus: "pending",
    createdAt: hoursAgo(1), updatedAt: hoursAgo(1),
    lines: [
      { id: 10, saleBillId: 4, itemId: 1, unitId: 1000, qtyInSoldUnit: 80, qtyInBaseUnit: 80, unitPriceAtSale: 5, lineTotal: 400, createdAt: hoursAgo(1) },
      { id: 11, saleBillId: 4, itemId: 13, unitId: 1022, qtyInSoldUnit: 35, qtyInBaseUnit: 35, unitPriceAtSale: 4, lineTotal: 140, createdAt: hoursAgo(1) },
    ],
  },
];

// Purchase bills — unitCost semantics changed (per resolution #5):
//   unitCost = cost per SELECTED unit (e.g. 1 Box = Rs. 350 for Box of 50)
//   costPerBaseUnit = unitCost / conversionToBase (derived, cached)
export const seedPurchaseBills: PurchaseBill[] = [
  {
    id: 1, uuid: "pur-0001-aaaa-bbbb-cccc0001", shopId: 1, supplierId: 3, billDate: daysAgo(3),
    paymentType: "udhaar", totalAmount: 974, syncStatus: "synced",
    createdAt: daysAgo(3), updatedAt: daysAgo(3),
    lines: [
      // M8 Bolt: 1 Box @ Rs. 350 per box = 50 pieces at Rs. 7 each
      { id: 1, purchaseBillId: 1, itemId: 11, unitId: 1019, qtyInPurchasedUnit: 1, qtyInBaseUnit: 50, unitCost: 350, costPerBaseUnit: 7, lineTotal: 350, createdAt: daysAgo(3) },
      // M8 Nut: 1 Box @ Rs. 200 per box = 100 pieces at Rs. 2 each
      { id: 2, purchaseBillId: 1, itemId: 13, unitId: 1023, qtyInPurchasedUnit: 1, qtyInBaseUnit: 100, unitCost: 200, costPerBaseUnit: 2, lineTotal: 200, createdAt: daysAgo(3) },
      // Wood Screw: 4 Box @ Rs. 70 per box (Box=20) = 80 pieces at Rs. 3.5 each
      { id: 3, purchaseBillId: 1, itemId: 4, unitId: 1008, qtyInPurchasedUnit: 4, qtyInBaseUnit: 80, unitCost: 70, costPerBaseUnit: 3.5, lineTotal: 280, createdAt: daysAgo(3) },
      // Steel Nail: 4 Box @ Rs. 36 per box (Box=12) = 48 pieces at Rs. 3 each
      { id: 4, purchaseBillId: 1, itemId: 1, unitId: 1001, qtyInPurchasedUnit: 4, qtyInBaseUnit: 48, unitCost: 36, costPerBaseUnit: 3, lineTotal: 144, createdAt: daysAgo(3) },
    ],
  },
  {
    id: 2, uuid: "pur-0002-aaaa-bbbb-cccc0002", shopId: 1, supplierId: 1, billDate: daysAgo(7),
    paymentType: "udhaar", totalAmount: 7380, syncStatus: "synced",
    createdAt: daysAgo(7), updatedAt: daysAgo(7),
    lines: [
      { id: 5, purchaseBillId: 2, itemId: 6, unitId: 1011, qtyInPurchasedUnit: 15, qtyInBaseUnit: 15, unitCost: 220, costPerBaseUnit: 220, lineTotal: 3300, createdAt: daysAgo(7) },
      { id: 6, purchaseBillId: 2, itemId: 7, unitId: 1012, qtyInPurchasedUnit: 12, qtyInBaseUnit: 12, unitCost: 180, costPerBaseUnit: 180, lineTotal: 2160, createdAt: daysAgo(7) },
      { id: 7, purchaseBillId: 2, itemId: 15, unitId: 1026, qtyInPurchasedUnit: 6, qtyInBaseUnit: 6, unitCost: 320, costPerBaseUnit: 320, lineTotal: 1920, createdAt: daysAgo(7) },
    ],
  },
];

// Khata transactions — related_bill_id split into 3 explicit FKs (per resolution #6)
export const seedKhataTransactions: KhataTransaction[] = [
  // Customer 2 (Rashid) — owes 2400 now
  { id: 1, partyType: "customer", partyId: 2, transactionType: "credit_given", amount: 1240, relatedSaleBillId: 1, transactionDate: hoursAgo(2), createdAt: hoursAgo(2) },
  { id: 2, partyType: "customer", partyId: 2, transactionType: "payment_received", amount: 1000, transactionDate: daysAgo(3), note: "Partial payment", createdAt: daysAgo(3) },
  { id: 3, partyType: "customer", partyId: 2, transactionType: "credit_given", amount: 2160, transactionDate: daysAgo(5), note: "Earlier bill", createdAt: daysAgo(5) },
  // Customer 5 (Salim)
  { id: 4, partyType: "customer", partyId: 5, transactionType: "credit_given", amount: 3550, relatedSaleBillId: 3, transactionDate: daysAgo(1), createdAt: daysAgo(1) },
  { id: 5, partyType: "customer", partyId: 5, transactionType: "payment_received", amount: 250, transactionDate: daysAgo(2), createdAt: daysAgo(2) },
  // Customer 3 (Imran)
  { id: 6, partyType: "customer", partyId: 3, transactionType: "credit_given", amount: 8750, transactionDate: daysAgo(12), note: "Bulk supply", createdAt: daysAgo(12) },
  // Suppliers
  { id: 7, partyType: "supplier", partyId: 1, transactionType: "payable_incurred", amount: 7380, relatedPurchaseBillId: 2, transactionDate: daysAgo(7), createdAt: daysAgo(7) },
  { id: 8, partyType: "supplier", partyId: 3, transactionType: "payable_incurred", amount: 974, relatedPurchaseBillId: 1, transactionDate: daysAgo(3), createdAt: daysAgo(3) },
  { id: 9, partyType: "supplier", partyId: 3, transactionType: "payment_made", amount: 200, transactionDate: daysAgo(2), note: "Token advance", createdAt: daysAgo(2) },
];

// Notifications — khata_reminder added with shop_id (per resolution #7)
export const seedNotifications: AppNotification[] = [
  { id: 1, shopId: 1, type: "low_stock", message: "Cabinet Lock is low on stock (5 left)", relatedItemId: 8, isRead: false, createdAt: hoursAgo(3) },
  { id: 2, shopId: 1, type: "low_stock", message: "Wall Screw is low on stock (45 left)", relatedItemId: 5, isRead: false, createdAt: hoursAgo(6) },
  { id: 3, shopId: 1, type: "low_stock", message: "Screwdriver Set is low on stock (8 sets)", relatedItemId: 16, isRead: false, createdAt: hoursAgo(8) },
  { id: 4, shopId: 1, type: "khata_reminder", message: "Imran Construction owes Rs. 8,750 (since 12 days)", relatedCustomerId: 3, isRead: false, createdAt: hoursAgo(4) },
  { id: 5, shopId: 1, type: "khata_reminder", message: "Salim Builder owes Rs. 3,300", relatedCustomerId: 5, isRead: true, createdAt: daysAgo(1) },
];

export const seedRateHistory: RateHistoryEntry[] = [
  { id: 1, itemId: 1, oldPrice: 4, newPrice: 5, changedAt: daysAgo(8) },
  { id: 2, itemId: 6, oldPrice: 320, newPrice: 350, changedAt: daysAgo(4) },
];

// Stock adjustments (per resolution #2)
export const seedStockAdjustments: StockAdjustment[] = [
  { id: 1, itemId: 8, type: "loss", deltaInBaseUnit: -10, newQtyInBaseUnit: 5, reason: "Damaged in storage", adjustedAt: daysAgo(2) },
  { id: 2, itemId: 1, type: "restock", deltaInBaseUnit: 50, newQtyInBaseUnit: 350, reason: "Found extra box in back room", adjustedAt: daysAgo(5) },
];

export const seedAiImportSessions: AiImportSession[] = [
  {
    id: 1, shopId: 1, sourceType: "photo",
    rawExtracted: [
      { name: "M12 Bolt", price: 25 },
      { name: "M12 Nut", price: 8 },
      { name: "Wall Plug 8mm", price: 2 },
      { name: "Door Hinge 5in", price: 130 },
    ],
    status: "awaiting_review",
    createdAt: hoursAgo(2), updatedAt: hoursAgo(2),
  },
];
