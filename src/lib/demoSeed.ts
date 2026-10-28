import { localDb } from "./localDb";
import {
  cancelLocalSale,
  createLocalCategory,
  createLocalCustomer,
  createLocalItem,
  createLocalPurchase,
  createLocalCustomerReturn,
  createLocalStockAdjustment,
  createLocalSupplier,
  createLocalSale,
  recordLocalPayment,
} from "./localServices";
import { generateLocalNotifications } from "./localNotifications";

const demo = true;
const daysAgo = (days: number): string => new Date(Date.now() - days * 86400000).toISOString();

const categoryData = [
  ["Nails", "کیلیں"], ["Screws", "سکرو"], ["Bolts & Nuts", "بولٹ اور نٹ"], ["Locks", "تالے"],
  ["Hinges & Door Hardware", "قبضے اور دروازے کا سامان"], ["Tapes & Glues", "ٹیپ اور گوند"],
  ["Mesh & Wire", "جالی اور تار"], ["Hand Tools", "اوزار"],
] as const;

const skuData = [
  ["N-WD-2", "Wood nail 2\"", "لکڑی کی کیل 2 انچ", "Nails", "g", "AMOUNT_EST", 0.30, 0.45, 20000, 5000],
  ["N-WD-3", "Wood nail 3\"", "لکڑی کی کیل 3 انچ", "Nails", "g", "AMOUNT_EST", 0.28, 0.42, 15000, 4000],
  ["N-LH-2", "Lost-head nail 2\"", "بغیر سر کی کیل 2 انچ", "Nails", "g", "AMOUNT_EST", 0.32, 0.45, 12000, 3000],
  ["N-CN-2", "Concrete nail 2\"", "سیمنٹ کی کیل 2 انچ", "Nails", "g", "AMOUNT_EST", 0.40, 0.60, 8000, 2000],
  ["N-RF-2", "Roofing nail 2\"", "چھت کی کیل 2 انچ", "Nails", "g", "AMOUNT_EST", 0.35, 0.50, 6000, 2000],
  ["S-WD-1", "Wood screw 1\"", "لکڑی کا سکرو 1 انچ", "Screws", "piece", "QTY", 1.20, 2, 2000, 500],
  ["S-WD-2", "Wood screw 2\"", "لکڑی کا سکرو 2 انچ", "Screws", "piece", "QTY", 1.80, 3, 1500, 400],
  ["S-DW-15", "Drywall screw 1.5\"", "ڈرائی وال سکرو 1.5 انچ", "Screws", "piece", "QTY", 0.90, 1.50, 3000, 800],
  ["S-ST-1", "Self-tapping screw 1\"", "سیلف ٹیپنگ سکرو 1 انچ", "Screws", "piece", "QTY", 1, 2, 2000, 500],
  ["B-M8-50", "Nut bolt M8x50", "نٹ بولٹ M8x50", "Bolts & Nuts", "piece", "QTY", 18, 30, 400, 100],
  ["B-M10-75", "Nut bolt M10x75", "نٹ بولٹ M10x75", "Bolts & Nuts", "piece", "QTY", 35, 55, 250, 60],
  ["B-RW-10", "Rawl bolt 10 mm", "راول بولٹ 10 ملی میٹر", "Bolts & Nuts", "piece", "QTY", 20, 35, 300, 80],
  ["NUT-M8", "Nut M8", "نٹ M8", "Bolts & Nuts", "piece", "QTY", 6, 10, 600, 150],
  ["WSH-M8", "Washer M8", "واشر M8", "Bolts & Nuts", "piece", "QTY", 2, 4, 800, 200],
  ["P-PL-8", "Plastic plug 8 mm (pack of 100)", "پلاسٹک پلگ 8 ملی میٹر (100 کا پیک)", "Bolts & Nuts", "piece", "PACK", 1, 1.5, 1000, 300],
  ["L-PAD-50", "Padlock 50 mm", "تالا 50 ملی میٹر", "Locks", "piece", "QTY", 450, 650, 24, 6],
  ["L-PAD-65", "Padlock 65 mm", "تالا 65 ملی میٹر", "Locks", "piece", "QTY", 750, 1100, 12, 4],
  ["L-MOR-6", "Mortise lock 6-lever", "مورٹائز لاک 6 لیور", "Locks", "piece", "QTY", 1800, 2500, 10, 3],
  ["L-KNOB", "Knob lock", "نوب لاک", "Locks", "piece", "QTY", 1200, 1700, 2, 3],
  ["L-CAM", "Cam lock", "کیم لاک", "Locks", "piece", "QTY", 120, 200, 30, 8],
  ["H-BUT-3", "Butt hinge 3\"", "قبضہ 3 انچ", "Hinges & Door Hardware", "piece", "QTY", 55, 90, 100, 30],
  ["H-BUT-4", "Butt hinge 4\"", "قبضہ 4 انچ", "Hinges & Door Hardware", "piece", "QTY", 80, 130, 80, 24],
  ["H-SPR-3", "Spring hinge 3\"", "اسپرنگ قبضہ 3 انچ", "Hinges & Door Hardware", "piece", "QTY", 150, 240, 0, 6],
  ["D-BOLT-6", "Sliding bolt 6\"", "کنڈی 6 انچ", "Hinges & Door Hardware", "piece", "QTY", 90, 150, 40, 10],
  ["DH-BR", "Brass door handle set", "پیتل کا ہینڈل سیٹ", "Hinges & Door Hardware", "set", "QTY", 600, 900, 15, 4],
  ["TP-MASK", "Masking tape 1\" roll", "ماسکنگ ٹیپ 1 انچ", "Tapes & Glues", "roll", "QTY", 85, 130, 60, 15],
  ["TP-DUCT", "Duct tape roll", "ڈکٹ ٹیپ", "Tapes & Glues", "roll", "QTY", 220, 330, 30, 8],
  ["TP-DBL", "Double-sided tape roll", "ڈبل سائیڈ ٹیپ", "Tapes & Glues", "roll", "QTY", 60, 100, 40, 10],
  ["G-SUP", "Super glue tube", "سپر گلو ٹیوب", "Tapes & Glues", "piece", "QTY", 25, 50, 80, 20],
  ["G-EPX", "Epoxy 2-part pack", "ایپوکسی گوند", "Tapes & Glues", "piece", "QTY", 260, 380, 5, 6],
  ["G-SIL", "Silicone sealant tube", "سلیکون ٹیوب", "Tapes & Glues", "piece", "QTY", 330, 480, 30, 8],
  ["G-PVA", "Wood glue 250 g", "لکڑی کی گوند 250 گرام", "Tapes & Glues", "piece", "QTY", 140, 210, 24, 6],
  ["M-MOS", "Fiberglass mosquito mesh", "مچھر جالی", "Mesh & Wire", "m", "QTY", 38, 60, 150, 30],
  ["M-CHK", "Chicken wire 3 ft", "چکن وائر 3 فٹ", "Mesh & Wire", "m", "QTY", 120, 180, 100, 20],
  ["WR-BIND", "Binding wire", "بائنڈنگ تار", "Mesh & Wire", "g", "WEIGHT", 0.30, 0.38, 50000, 10000],
  ["T-HAM-1", "Claw hammer 1 lb", "ہتھوڑا 1 پاؤنڈ", "Hand Tools", "piece", "QTY", 450, 650, 12, 3],
  ["T-TAPE-5", "Measuring tape 5 m", "ناپنے کا فیتہ 5 میٹر", "Hand Tools", "piece", "QTY", 180, 280, 25, 6],
  ["T-SD-PH", "Screwdriver Phillips 6\"", "پیچ کس فلپس 6 انچ", "Hand Tools", "piece", "QTY", 90, 150, 30, 8],
  ["T-PLR-8", "Combination pliers 8\"", "پلاس 8 انچ", "Hand Tools", "piece", "QTY", 320, 480, 15, 4],
  ["T-HACK", "Hacksaw frame", "ہیکسا فریم", "Hand Tools", "piece", "QTY", 240, 370, 12, 3],
  ["T-BLADE", "Hacksaw blade", "ہیکسا بلیڈ", "Hand Tools", "piece", "QTY", 25, 45, 100, 30],
] as const;

type DemoItem = Awaited<ReturnType<typeof createLocalItem>>;

const itemUnit = (item: DemoItem, name: string): number => {
  const unit = item.units.find((candidate) => candidate.unitName === name);
  if (!unit) throw new Error(`Demo unit ${name} missing for ${item.skuCode}`);
  return unit.id;
};

export async function seedDemoData(): Promise<{ items: Map<string, DemoItem>; customerId: number; supplierIds: Record<string, number> }> {
  if ((await localDb.items.toArray()).some((item) => item.isDemo)) {
    throw new Error("Demo data already exists; clear the local database before reseeding");
  }
  await localDb.settings.put({ key: "shopConfig", value: { billRoundingEnabled: true, khataReminderThresholdAmount: 100, khataReminderThresholdDays: 1 } });
  const categories = new Map<string, number>();
  for (const [index, [name, urduName]] of categoryData.entries()) {
    const category = await createLocalCategory({ uuid: `demo-category-${index}`, name, urduName, isDemo: demo });
    categories.set(name, category.id);
  }
  const items = new Map<string, DemoItem>();
  for (const [index, [skuCode, name, urduName, category, baseUnitName, saleMode, cost, price, openingQty, minStock]] of skuData.entries()) {
    const item = await createLocalItem({
      uuid: `demo-item-${index}`, categoryId: categories.get(category)!, name, urduName, skuCode, baseUnitName,
      saleMode, costPerBaseUnit: cost, pricePerBaseUnit: price, openingQty, lowStockThreshold: minStock,
      conversionUnits: skuCode === "P-PL-8" ? [{ name: "pack", conversionToBase: 100 }] : skuCode === "N-WD-2" ? [{ name: "kg", conversionToBase: 1000 }, { name: "box", conversionToBase: 1000 }] : skuCode === "WR-BIND" ? [{ name: "kg", conversionToBase: 1000 }] : [],
      isDemo: demo,
    });
    items.set(skuCode, item);
  }
  const ustad = await createLocalCustomer({ uuid: "demo-customer-ustad", name: "Ustad Rafiq", phone: "0300-0000001", notes: "regular", isDemo: demo });
  const haji = await createLocalCustomer({ uuid: "demo-customer-haji", name: "Haji Shafi", phone: "0300-0000002", notes: "credit customer", isDemo: demo });
  await createLocalCustomer({ uuid: "demo-customer-bilal", name: "Bilal Electric Works", phone: "0300-0000003", isDemo: demo });
  const suppliers: Record<string, number> = {};
  for (const [key, name, phone] of [["lft", "Lahore Fasteners Traders", "0300-1000001"], ["klh", "Karachi Lock House", "0300-1000002"], ["rwm", "Rawalpindi Wire & Mesh", "0300-1000003"]] as const) {
    suppliers[key] = (await createLocalSupplier({ uuid: `demo-supplier-${key}`, name, phone, isDemo: demo })).id;
  }
  const base = (sku: string) => itemUnit(items.get(sku)!, items.get(sku)!.baseUnitName);
  await createLocalPurchase({ uuid: "demo-p1", supplierId: suppliers.lft, paymentType: "partial", amountPaid: 4000, date: daysAgo(30), isDemo: demo, lines: [
    { itemId: items.get("N-WD-2")!.id, unitId: base("N-WD-2"), qty: 20000, unitCost: 0.30 },
    { itemId: items.get("N-CN-2")!.id, unitId: base("N-CN-2"), qty: 10000, unitCost: 0.40 },
  ] });
  await createLocalPurchase({ uuid: "demo-p2", supplierId: suppliers.klh, paymentType: "cash", date: daysAgo(20), isDemo: demo, lines: [
    { itemId: items.get("L-PAD-50")!.id, unitId: base("L-PAD-50"), qty: 12, unitCost: 480 },
  ] });
  const sale = async (uuid: string, lines: Parameters<typeof createLocalSale>[0]["lines"], paymentType: "cash" | "partial" | "udhaar", amountPaid: number | undefined, date: number, customerId?: number) =>
    createLocalSale({ uuid, lines, paymentType, amountPaid, customerId, date: daysAgo(date), isDemo: demo });
  await sale("demo-s1", [{ itemId: items.get("L-PAD-50")!.id, unitId: base("L-PAD-50"), qty: 3, unitPrice: 650 }], "cash", undefined, 10);
  await sale("demo-s2", [{ itemId: items.get("N-WD-2")!.id, unitId: base("N-WD-2"), qty: 0, saleMode: "AMOUNT_EST", estimatedWeight: { saleAmount: 100, ratePerKg: 450 } }], "cash", undefined, 10);
  await sale("demo-s3", [{ itemId: items.get("N-WD-2")!.id, unitId: base("N-WD-2"), qty: 0, saleMode: "AMOUNT_EST", estimatedWeight: { saleAmount: 100, ratePerKg: 350 } }], "cash", undefined, 9);
  const s4 = await sale("demo-s4", [
    { itemId: items.get("H-BUT-4")!.id, unitId: base("H-BUT-4"), qty: 8, unitPrice: 130 },
    { itemId: items.get("D-BOLT-6")!.id, unitId: base("D-BOLT-6"), qty: 4, unitPrice: 150 },
    { itemId: items.get("B-M8-50")!.id, unitId: base("B-M8-50"), qty: 12, unitPrice: 30 },
  ], "partial", 500, 8, haji.id);
  await sale("demo-s5", [{ itemId: items.get("T-SD-PH")!.id, unitId: base("T-SD-PH"), qty: 1, unitPrice: 80 }], "cash", undefined, 7);
  await sale("demo-s6", [{ itemId: items.get("P-PL-8")!.id, unitId: itemUnit(items.get("P-PL-8")!, "pack"), qty: 1, unitPrice: 150, saleMode: "PACK" }], "cash", undefined, 6);
  await sale("demo-s7", [{ itemId: items.get("WR-BIND")!.id, unitId: base("WR-BIND"), qty: 250, measuredWeight: 250, unitPrice: 0.38, saleMode: "WEIGHT" }], "cash", undefined, 5);
  const s8 = await sale("demo-s8", [{ itemId: items.get("TP-MASK")!.id, unitId: base("TP-MASK"), qty: 1, unitPrice: 130 }], "cash", undefined, 5);
  await recordLocalPayment({ uuid: "demo-pay1", partyType: "customer", partyId: haji.id, amount: 1000, date: daysAgo(4), isDemo: demo });
  const returnLine = s4.lines.find((line) => line.itemId === items.get("H-BUT-4")!.id)!;
  await createLocalCustomerReturn({ uuid: "demo-r1", saleBillLineId: returnLine.id, qtyReturnedInBaseUnit: 2, reason: "wrong_item", disposition: "back_to_sellable_stock", date: daysAgo(3), isDemo: demo });
  await cancelLocalSale({ uuid: "demo-c1", saleBillId: s8.id, reason: "wrong entry", date: daysAgo(5), isDemo: demo });
  await createLocalStockAdjustment({ uuid: "demo-count", itemId: items.get("T-TAPE-5")!.id, type: "correction", deltaInBaseUnit: 0, countedQtyInBaseUnit: 24, reason: "count", date: daysAgo(2), isDemo: demo });
  await generateLocalNotifications();
  return { items, customerId: haji.id, supplierIds: suppliers };
}

export async function clearDemoData(): Promise<void> {
  const tables = [
    localDb.categories, localDb.items, localDb.customers, localDb.suppliers, localDb.saleBills, localDb.purchaseBills,
    localDb.returns, localDb.khataTransactions, localDb.notifications, localDb.stockAdjustments, localDb.inventoryMovements,
    localDb.auditLogs, localDb.payments,
  ] as const;
  await localDb.transaction("rw", tables, async () => {
    for (const table of tables) {
      const ids = (await table.toArray() as Array<{ id: number; isDemo?: boolean }>).filter((row) => row.isDemo).map((row) => row.id);
      if (ids.length) await table.bulkDelete(ids);
    }
  });
}

export async function assertDemoExpected(): Promise<void> {
  const expected: Record<string, number> = {
    "N-WD-2": 39490, "N-CN-2": 18000, "L-PAD-50": 33, "H-BUT-4": 74,
    "D-BOLT-6": 36, "B-M8-50": 388, "T-SD-PH": 29, "P-PL-8": 900,
    "WR-BIND": 49750, "TP-MASK": 60, "T-TAPE-5": 24, "H-SPR-3": 0,
  };
  const items = await localDb.items.toArray();
  for (const [sku, quantity] of Object.entries(expected)) {
    const item = items.find((candidate) => candidate.skuCode === sku);
    if (!item || item.qtyInBaseUnit !== quantity) throw new Error(`Demo stock mismatch for ${sku}: expected ${quantity}, got ${item?.qtyInBaseUnit}`);
  }
  const padlock = items.find((item) => item.skuCode === "L-PAD-50");
  if (!padlock || padlock.costPerBaseUnit !== 460) throw new Error(`Demo weighted cost mismatch: expected 460, got ${padlock?.costPerBaseUnit}`);
  const haji = (await localDb.customers.toArray()).find((customer) => customer.name === "Haji Shafi");
  if (!haji || haji.khataBalance !== 240) throw new Error(`Demo customer balance mismatch: expected 240, got ${haji?.khataBalance}`);
  const suppliers = await localDb.suppliers.toArray();
  const lft = suppliers.find((supplier) => supplier.name === "Lahore Fasteners Traders");
  const klh = suppliers.find((supplier) => supplier.name === "Karachi Lock House");
  if (lft?.payableBalance !== 6000 || klh?.payableBalance !== 0) throw new Error("Demo supplier payable mismatch");
  const notifications = await localDb.notifications.toArray();
  const lowStock = notifications.filter((notification) => notification.type === "low_stock");
  for (const sku of ["L-KNOB", "G-EPX", "H-SPR-3"]) {
    const item = items.find((candidate) => candidate.skuCode === sku);
    if (!item || !lowStock.some((notification) => notification.relatedItemId === item.id)) throw new Error(`Missing low-stock notification for ${sku}`);
  }
  if (!notifications.some((notification) => notification.type === "khata_reminder")) throw new Error("Missing Udhaar reminder");
  const sales = (await localDb.saleBills.toArray()).filter((bill) => !bill.cancelled);
  const gross = sales.reduce((sum, bill) => sum + bill.totalAmount, 0);
  const returns = (await localDb.returns.toArray()).filter((entry) => entry.saleBillLineId).reduce((sum, entry) => sum + entry.refundAmount, 0);
  if (gross !== 4475 || returns !== 260 || gross - returns !== 4215) throw new Error(`Demo sales mismatch: gross ${gross}, returns ${returns}`);
  const cancelled = (await localDb.saleBills.toArray()).filter((bill) => bill.cancelled);
  if (cancelled.length !== 1) throw new Error("Demo cancellation mismatch");
}
