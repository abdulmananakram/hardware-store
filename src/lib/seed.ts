import {
  Category,
  Item,
  Customer,
  Supplier,
  SaleBill,
  PurchaseBill,
  KhataTransaction,
  AppNotification,
  RateHistoryEntry,
  AiImportSession,
} from "./types";

// ============================================================
// Seed data — represents a small hardware shop's first state
// ============================================================

const now = () => new Date().toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 60 * 60 * 1000).toISOString();

export const seedCategories: Category[] = [
  { id: 1, shopId: 1, name: "Nails", urduName: "کیل", icon: "📍", parentCategoryId: null },
  { id: 2, shopId: 1, name: "Screws", urduName: "پیچ", icon: "🪛", parentCategoryId: null },
  { id: 3, shopId: 1, name: "Locks", urduName: "تالے", icon: "🔒", parentCategoryId: null },
  { id: 4, shopId: 1, name: "Hinges", urduName: "قبضے", icon: "🚪", parentCategoryId: null },
  { id: 5, shopId: 1, name: "Bolts", urduName: "بولٹ", icon: "⚙️", parentCategoryId: null },
  { id: 6, shopId: 1, name: "Nuts", urduName: "نٹ", icon: "🔩", parentCategoryId: null },
  { id: 7, shopId: 1, name: "Tools", urduName: "اوزار", icon: "🛠️", parentCategoryId: null },
  { id: 8, shopId: 1, name: "Paint", urduName: "رنگ", icon: "🎨", parentCategoryId: null },
];

let unitIdCounter = 1000;
const makeUnits = (baseName: string, extras: { name: string; conv: number }[] = []) => {
  const units = [
    { id: unitIdCounter++, unitName: baseName, conversionToBase: 1, isBaseUnit: true },
    ...extras.map((e) => ({
      id: unitIdCounter++,
      unitName: e.name,
      conversionToBase: e.conv,
      isBaseUnit: false,
    })),
  ];
  return units;
};

export const seedItems: Item[] = [
  // Nails
  {
    id: 1, shopId: 1, categoryId: 1, name: "Steel Nail", urduName: "اسٹیل کیل", icon: "📍",
    baseUnitName: "Piece", qtyInBaseUnit: 350, pricePerBaseUnit: 5, costPerBaseUnit: 3,
    lowStockThreshold: 100, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 12 }, { name: "Kg", conv: 50 }]),
  },
  {
    id: 2, shopId: 1, categoryId: 1, name: "Wall Nail", urduName: "دیوار کیل", icon: "📍",
    baseUnitName: "Piece", qtyInBaseUnit: 60, pricePerBaseUnit: 3, costPerBaseUnit: 1.5,
    lowStockThreshold: 80, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 25 }]),
  },
  {
    id: 3, shopId: 1, categoryId: 1, name: "Concrete Nail", urduName: "کنکریٹ کیل", icon: "📍",
    baseUnitName: "Piece", qtyInBaseUnit: 200, pricePerBaseUnit: 4, costPerBaseUnit: 2,
    lowStockThreshold: 50, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 20 }]),
  },
  // Screws
  {
    id: 4, shopId: 1, categoryId: 2, name: "Wood Screw", urduName: "لکڑی پیچ", icon: "🪛",
    baseUnitName: "Piece", qtyInBaseUnit: 180, pricePerBaseUnit: 6, costPerBaseUnit: 3.5,
    lowStockThreshold: 60, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 20 }]),
  },
  {
    id: 5, shopId: 1, categoryId: 2, name: "Wall Screw", urduName: "دیوار پیچ", icon: "🪛",
    baseUnitName: "Piece", qtyInBaseUnit: 45, pricePerBaseUnit: 8, costPerBaseUnit: 4,
    lowStockThreshold: 50, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 15 }]),
  },
  // Locks
  {
    id: 6, shopId: 1, categoryId: 3, name: "Door Lock 60mm", urduName: "دروازہ تالا", icon: "🔒",
    baseUnitName: "Piece", qtyInBaseUnit: 25, pricePerBaseUnit: 350, costPerBaseUnit: 220,
    lowStockThreshold: 10, isActive: true,
    units: makeUnits("Piece"),
  },
  {
    id: 7, shopId: 1, categoryId: 3, name: "Padlock 50mm", urduName: "پیڈلاک", icon: "🔒",
    baseUnitName: "Piece", qtyInBaseUnit: 18, pricePerBaseUnit: 280, costPerBaseUnit: 180,
    lowStockThreshold: 8, isActive: true,
    units: makeUnits("Piece"),
  },
  {
    id: 8, shopId: 1, categoryId: 3, name: "Cabinet Lock", urduName: "الमاری تالا", icon: "🔒",
    baseUnitName: "Piece", qtyInBaseUnit: 5, pricePerBaseUnit: 180, costPerBaseUnit: 120,
    lowStockThreshold: 6, isActive: true,
    units: makeUnits("Piece"),
  },
  // Hinges
  {
    id: 9, shopId: 1, categoryId: 4, name: "Door Hinge 4in", urduName: "دروازہ قبضہ", icon: "🚪",
    baseUnitName: "Pair", qtyInBaseUnit: 40, pricePerBaseUnit: 95, costPerBaseUnit: 60,
    lowStockThreshold: 15, isActive: true,
    units: makeUnits("Pair", [{ name: "Dozen", conv: 12 }]),
  },
  {
    id: 10, shopId: 1, categoryId: 4, name: "Cabinet Hinge 2in", urduName: "الماری قبضہ", icon: "🚪",
    baseUnitName: "Pair", qtyInBaseUnit: 120, pricePerBaseUnit: 35, costPerBaseUnit: 22,
    lowStockThreshold: 30, isActive: true,
    units: makeUnits("Pair", [{ name: "Dozen", conv: 12 }]),
  },
  // Bolts
  {
    id: 11, shopId: 1, categoryId: 5, name: "M8 Bolt", urduName: "ایم 8 بولٹ", icon: "⚙️",
    baseUnitName: "Piece", qtyInBaseUnit: 280, pricePerBaseUnit: 12, costPerBaseUnit: 7,
    lowStockThreshold: 100, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 50 }]),
  },
  {
    id: 12, shopId: 1, categoryId: 5, name: "M10 Bolt", urduName: "ایم 10 بولٹ", icon: "⚙️",
    baseUnitName: "Piece", qtyInBaseUnit: 75, pricePerBaseUnit: 18, costPerBaseUnit: 10,
    lowStockThreshold: 80, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 50 }]),
  },
  // Nuts
  {
    id: 13, shopId: 1, categoryId: 6, name: "M8 Nut", urduName: "ایم 8 نٹ", icon: "🔩",
    baseUnitName: "Piece", qtyInBaseUnit: 500, pricePerBaseUnit: 4, costPerBaseUnit: 2,
    lowStockThreshold: 150, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 100 }]),
  },
  {
    id: 14, shopId: 1, categoryId: 6, name: "M10 Lock Nut", urduName: "ایم 10 لاک نٹ", icon: "🔩",
    baseUnitName: "Piece", qtyInBaseUnit: 320, pricePerBaseUnit: 6, costPerBaseUnit: 3,
    lowStockThreshold: 100, isActive: true,
    units: makeUnits("Piece", [{ name: "Box", conv: 100 }]),
  },
  // Tools
  {
    id: 15, shopId: 1, categoryId: 7, name: "Hammer", urduName: "ہتھوڑا", icon: "🛠️",
    baseUnitName: "Piece", qtyInBaseUnit: 12, pricePerBaseUnit: 450, costPerBaseUnit: 320,
    lowStockThreshold: 5, isActive: true,
    units: makeUnits("Piece"),
  },
  {
    id: 16, shopId: 1, categoryId: 7, name: "Screwdriver Set", urduName: "اسکرو ڈرائیور", icon: "🛠️",
    baseUnitName: "Set", qtyInBaseUnit: 8, pricePerBaseUnit: 600, costPerBaseUnit: 420,
    lowStockThreshold: 4, isActive: true,
    units: makeUnits("Set"),
  },
  // Paint
  {
    id: 17, shopId: 1, categoryId: 8, name: "White Paint 4L", urduName: "سفید رنگ", icon: "🎨",
    baseUnitName: "Tin", qtyInBaseUnit: 20, pricePerBaseUnit: 1200, costPerBaseUnit: 920,
    lowStockThreshold: 8, isActive: true,
    units: makeUnits("Tin"),
  },
  {
    id: 18, shopId: 1, categoryId: 8, name: "Primer 1L", urduName: "پرائمری", icon: "🎨",
    baseUnitName: "Tin", qtyInBaseUnit: 14, pricePerBaseUnit: 480, costPerBaseUnit: 320,
    lowStockThreshold: 6, isActive: true,
    units: makeUnits("Tin"),
  },
];

export const seedCustomers: Customer[] = [
  { id: 1, shopId: 1, name: "Walk-in Customer", phone: undefined, khataBalance: 0, createdAt: daysAgo(60) },
  { id: 2, shopId: 1, name: "Rashid Khan", phone: "0301-2345678", khataBalance: 2400, createdAt: daysAgo(45) },
  { id: 3, shopId: 1, name: "Imran Construction", phone: "0321-9876543", khataBalance: 8750, createdAt: daysAgo(30) },
  { id: 4, shopId: 1, name: "Bilal Ahmad", phone: "0333-1122334", khataBalance: 0, createdAt: daysAgo(20) },
  { id: 5, shopId: 1, name: "Salim Builder", phone: "0345-5566778", khataBalance: 5300, createdAt: daysAgo(15) },
];

export const seedSuppliers: Supplier[] = [
  { id: 1, shopId: 1, name: "Pak Steel Traders", phone: "042-111-222", payableBalance: 12500, createdAt: daysAgo(60) },
  { id: 2, shopId: 1, name: "Lahore Hardware Co.", phone: "042-333-444", payableBalance: 0, createdAt: daysAgo(40) },
  { id: 3, shopId: 1, name: "Fastener World", phone: "042-555-666", payableBalance: 4800, createdAt: daysAgo(25) },
];

// Sale bills: a few recent ones, some pending sync, some cash, some udhaar
export const seedSaleBills: SaleBill[] = [
  {
    id: 1, shopId: 1, customerId: 2, billDate: hoursAgo(2), paymentType: "udhaar",
    totalAmount: 1240, syncStatus: "synced",
    lines: [
      { id: 1, saleBillId: 1, itemId: 1, unitId: 1000, qtyInSoldUnit: 40, qtyInBaseUnit: 40, unitPriceAtSale: 5, lineTotal: 200 },
      { id: 2, saleBillId: 1, itemId: 11, unitId: 1018, qtyInSoldUnit: 20, qtyInBaseUnit: 20, unitPriceAtSale: 12, lineTotal: 240 },
      { id: 3, saleBillId: 1, itemId: 4, unitId: 1007, qtyInSoldUnit: 30, qtyInBaseUnit: 30, unitPriceAtSale: 6, lineTotal: 180 },
      { id: 4, saleBillId: 1, itemId: 13, unitId: 1022, qtyInSoldUnit: 50, qtyInBaseUnit: 50, unitPriceAtSale: 4, lineTotal: 200 },
      { id: 5, saleBillId: 1, itemId: 9, unitId: 1014, qtyInSoldUnit: 4, qtyInBaseUnit: 4, unitPriceAtSale: 95, lineTotal: 380 },
    ],
  },
  {
    id: 2, shopId: 1, customerId: null, billDate: hoursAgo(5), paymentType: "cash",
    totalAmount: 980, syncStatus: "synced",
    lines: [
      { id: 6, saleBillId: 2, itemId: 6, unitId: 1011, qtyInSoldUnit: 2, qtyInBaseUnit: 2, unitPriceAtSale: 350, lineTotal: 700 },
      { id: 7, saleBillId: 2, itemId: 7, unitId: 1012, qtyInSoldUnit: 1, qtyInBaseUnit: 1, unitPriceAtSale: 280, lineTotal: 280 },
    ],
  },
  {
    id: 3, shopId: 1, customerId: 5, billDate: daysAgo(1), paymentType: "udhaar",
    totalAmount: 3550, syncStatus: "synced",
    lines: [
      { id: 8, saleBillId: 3, itemId: 17, unitId: 1028, qtyInSoldUnit: 2, qtyInBaseUnit: 2, unitPriceAtSale: 1200, lineTotal: 2400 },
      { id: 9, saleBillId: 3, itemId: 9, unitId: 1014, qtyInSoldUnit: 12, qtyInBaseUnit: 12, unitPriceAtSale: 95, lineTotal: 1140 },
    ],
  },
  {
    id: 4, shopId: 1, customerId: null, billDate: hoursAgo(1), paymentType: "cash",
    totalAmount: 540, syncStatus: "pending",
    lines: [
      { id: 10, saleBillId: 4, itemId: 1, unitId: 1000, qtyInSoldUnit: 80, qtyInBaseUnit: 80, unitPriceAtSale: 5, lineTotal: 400 },
      { id: 11, saleBillId: 4, itemId: 13, unitId: 1022, qtyInSoldUnit: 35, qtyInBaseUnit: 35, unitPriceAtSale: 4, lineTotal: 140 },
    ],
  },
];

export const seedPurchaseBills: PurchaseBill[] = [
  {
    id: 1, shopId: 1, supplierId: 3, billDate: daysAgo(3), paymentType: "cash",
    totalAmount: 5000, syncStatus: "synced",
    lines: [
      { id: 1, purchaseBillId: 1, itemId: 11, unitId: 1019, qtyInPurchasedUnit: 1, qtyInBaseUnit: 50, unitCost: 7, lineTotal: 350 },
      { id: 2, purchaseBillId: 1, itemId: 13, unitId: 1023, qtyInPurchasedUnit: 1, qtyInBaseUnit: 100, unitCost: 2, lineTotal: 200 },
      { id: 3, purchaseBillId: 1, itemId: 4, unitId: 1008, qtyInPurchasedUnit: 4, qtyInBaseUnit: 80, unitCost: 3.5, lineTotal: 280 },
      { id: 4, purchaseBillId: 1, itemId: 1, unitId: 1001, qtyInPurchasedUnit: 4, qtyInBaseUnit: 48, unitCost: 3, lineTotal: 144 },
    ],
  },
  {
    id: 2, shopId: 1, supplierId: 1, billDate: daysAgo(7), paymentType: "udhaar",
    totalAmount: 8200, syncStatus: "synced",
    lines: [
      { id: 5, purchaseBillId: 2, itemId: 6, unitId: 1011, qtyInPurchasedUnit: 15, qtyInBaseUnit: 15, unitCost: 220, lineTotal: 3300 },
      { id: 6, purchaseBillId: 2, itemId: 7, unitId: 1012, qtyInPurchasedUnit: 12, qtyInBaseUnit: 12, unitCost: 180, lineTotal: 2160 },
      { id: 7, purchaseBillId: 2, itemId: 15, unitId: 1026, qtyInPurchasedUnit: 6, qtyInBaseUnit: 6, unitCost: 320, lineTotal: 1920 },
    ],
  },
];

export const seedKhataTransactions: KhataTransaction[] = [
  // Customer 2 (Rashid) — owes 2400 now
  { id: 1, partyType: "customer", partyId: 2, transactionType: "credit_given", amount: 1240, relatedBillId: 1, transactionDate: hoursAgo(2) },
  { id: 2, partyType: "customer", partyId: 2, transactionType: "payment_received", amount: 1000, transactionDate: daysAgo(3), note: "Partial payment" },
  { id: 3, partyType: "customer", partyId: 2, transactionType: "credit_given", amount: 2160, relatedBillId: undefined, transactionDate: daysAgo(5), note: "Earlier bill" },
  // Customer 5 (Salim)
  { id: 4, partyType: "customer", partyId: 5, transactionType: "credit_given", amount: 3550, relatedBillId: 3, transactionDate: daysAgo(1) },
  { id: 5, partyType: "customer", partyId: 5, transactionType: "payment_received", amount: 250, transactionDate: daysAgo(2) },
  // Customer 3 (Imran)
  { id: 6, partyType: "customer", partyId: 3, transactionType: "credit_given", amount: 8750, relatedBillId: undefined, transactionDate: daysAgo(12), note: "Bulk supply" },
  // Suppliers
  { id: 7, partyType: "supplier", partyId: 1, transactionType: "payable_incurred", amount: 8200, relatedBillId: 2, transactionDate: daysAgo(7) },
  { id: 8, partyType: "supplier", partyId: 3, transactionType: "payable_incurred", amount: 5000, relatedBillId: 1, transactionDate: daysAgo(3) },
  { id: 9, partyType: "supplier", partyId: 3, transactionType: "payment_made", amount: 200, transactionDate: daysAgo(2), note: "Token advance" },
];

export const seedNotifications: AppNotification[] = [
  { id: 1, type: "low_stock", message: "Cabinet Lock is low on stock (5 left)", relatedItemId: 8, isRead: false, createdAt: hoursAgo(3) },
  { id: 2, type: "low_stock", message: "Wall Screw is low on stock (45 left)", relatedItemId: 5, isRead: false, createdAt: hoursAgo(6) },
  { id: 3, type: "low_stock", message: "Screwdriver Set is low on stock (8 sets)", relatedItemId: 16, isRead: false, createdAt: hoursAgo(8) },
  { id: 4, type: "khata_reminder", message: "Imran Construction owes Rs. 8,750", relatedCustomerId: 3, isRead: false, createdAt: daysAgo(1) },
  { id: 5, type: "khata_reminder", message: "Salim Builder owes Rs. 5,300", relatedCustomerId: 5, isRead: true, createdAt: daysAgo(1) },
];

export const seedRateHistory: RateHistoryEntry[] = [
  { id: 1, itemId: 1, oldPrice: 4, newPrice: 5, changedAt: daysAgo(8) },
  { id: 2, itemId: 6, oldPrice: 320, newPrice: 350, changedAt: daysAgo(4) },
];

export const seedAiImportSessions: AiImportSession[] = [
  {
    id: 1,
    sourceType: "photo",
    rawExtracted: [
      { name: "M12 Bolt", price: 25 },
      { name: "M12 Nut", price: 8 },
      { name: "Wall Plug 8mm", price: 2 },
      { name: "Door Hinge 5in", price: 130 },
    ],
    status: "awaiting_review",
    createdAt: hoursAgo(2),
  },
];
