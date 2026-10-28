import Dexie, { type Table } from "dexie";
import type {
  AiImportSession,
  AppNotification,
  AuditLog,
  Category,
  CategoryImage,
  Customer,
  InventoryMovement,
  Item,
  CatalogueAttribute,
  CatalogueAttributeOption,
  KhataTransaction,
  PurchaseBill,
  RateHistoryEntry,
  Return,
  SaleBill,
  ShopConfig,
  StockAdjustment,
  Supplier,
} from "./types";

export interface LocalSetting {
  key: string;
  value: unknown;
}

export interface LocalSnapshot {
  shopConfig: ShopConfig;
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
  categoryImages: CategoryImage[];
  inventoryMovements: InventoryMovement[];
  auditLogs: AuditLog[];
  attributes?: CatalogueAttribute[];
  attributeOptions?: CatalogueAttributeOption[];
}

class HardwareShopDatabase extends Dexie {
  settings!: Table<LocalSetting, string>;
  categories!: Table<Category, number>;
  items!: Table<Item, number>;
  customers!: Table<Customer, number>;
  suppliers!: Table<Supplier, number>;
  saleBills!: Table<SaleBill, number>;
  purchaseBills!: Table<PurchaseBill, number>;
  returns!: Table<Return, number>;
  khataTransactions!: Table<KhataTransaction, number>;
  notifications!: Table<AppNotification, number>;
  rateHistory!: Table<RateHistoryEntry, number>;
  aiSessions!: Table<AiImportSession, number>;
  stockAdjustments!: Table<StockAdjustment, number>;
  categoryImages!: Table<CategoryImage, number>;
  inventoryMovements!: Table<InventoryMovement, number>;
  auditLogs!: Table<AuditLog, number>;
  attributes!: Table<CatalogueAttribute, number>;
  attributeOptions!: Table<CatalogueAttributeOption, number>;

  constructor() {
    super("hardware_shop_local_v1");
    this.version(1).stores({
      settings: "&key",
      categories: "id, shopId, name",
      items: "id, shopId, categoryId, name, isActive",
      customers: "id, shopId, name, phone",
      suppliers: "id, shopId, name, phone",
      saleBills: "id, uuid, shopId, billDate, syncStatus",
      purchaseBills: "id, uuid, shopId, billDate, syncStatus",
      returns: "id, saleBillLineId",
      khataTransactions: "id, partyType, partyId, transactionDate",
      notifications: "id, shopId, isRead, createdAt",
      rateHistory: "id, itemId, changedAt",
      aiSessions: "id, shopId, status",
      stockAdjustments: "id, itemId, adjustedAt",
      categoryImages: "id, categoryId, isDefault",
      inventoryMovements: "id, shopId, itemId, createdAt",
      auditLogs: "id, shopId, action, createdAt",
      attributes: "id, shopId, categoryId, sortOrder",
      attributeOptions: "id, attributeId, sortOrder",
    });
  }
}

export const localDb = new HardwareShopDatabase();

const snapshotTables = [
  "categories",
  "items",
  "customers",
  "suppliers",
  "saleBills",
  "purchaseBills",
  "returns",
  "khataTransactions",
  "notifications",
  "rateHistory",
  "aiSessions",
  "stockAdjustments",
  "categoryImages",
  "inventoryMovements",
  "auditLogs",
] as const;

export async function saveLocalSnapshot(snapshot: LocalSnapshot): Promise<void> {
  await localDb.transaction(
    "rw",
    [
      localDb.settings,
      localDb.categories,
      localDb.items,
      localDb.customers,
      localDb.suppliers,
      localDb.saleBills,
      localDb.purchaseBills,
      localDb.returns,
      localDb.khataTransactions,
      localDb.notifications,
      localDb.rateHistory,
      localDb.aiSessions,
      localDb.stockAdjustments,
      localDb.categoryImages,
      localDb.inventoryMovements,
      localDb.auditLogs,
      localDb.attributes,
      localDb.attributeOptions,
    ],
    async () => {
      await localDb.settings.put({ key: "shopConfig", value: snapshot.shopConfig });
      await localDb.categories.clear();
      await localDb.categories.bulkPut(snapshot.categories);
      await localDb.items.clear();
      await localDb.items.bulkPut(snapshot.items);
      await localDb.customers.clear();
      await localDb.customers.bulkPut(snapshot.customers);
      await localDb.suppliers.clear();
      await localDb.suppliers.bulkPut(snapshot.suppliers);
      await localDb.saleBills.clear();
      await localDb.saleBills.bulkPut(snapshot.saleBills);
      await localDb.purchaseBills.clear();
      await localDb.purchaseBills.bulkPut(snapshot.purchaseBills);
      await localDb.returns.clear();
      await localDb.returns.bulkPut(snapshot.returns);
      await localDb.khataTransactions.clear();
      await localDb.khataTransactions.bulkPut(snapshot.khataTransactions);
      await localDb.notifications.clear();
      await localDb.notifications.bulkPut(snapshot.notifications);
      await localDb.rateHistory.clear();
      await localDb.rateHistory.bulkPut(snapshot.rateHistory);
      await localDb.aiSessions.clear();
      await localDb.aiSessions.bulkPut(snapshot.aiSessions);
      await localDb.stockAdjustments.clear();
      await localDb.stockAdjustments.bulkPut(snapshot.stockAdjustments);
      await localDb.categoryImages.clear();
      await localDb.categoryImages.bulkPut(snapshot.categoryImages);
      await localDb.inventoryMovements.clear();
      await localDb.inventoryMovements.bulkPut(snapshot.inventoryMovements);
      await localDb.auditLogs.clear();
      await localDb.auditLogs.bulkPut(snapshot.auditLogs);
      await localDb.attributes.clear();
      await localDb.attributes.bulkPut(snapshot.attributes ?? []);
      await localDb.attributeOptions.clear();
      await localDb.attributeOptions.bulkPut(snapshot.attributeOptions ?? []);
    }
  );
}

export async function loadLocalSnapshot(): Promise<LocalSnapshot | null> {
  const [config, ...rows] = await Promise.all([
    localDb.settings.get("shopConfig"),
    ...snapshotTables.map((table) => localDb[table].toArray()),
  ]);
  if (!config) return null;
  return {
    shopConfig: config.value as ShopConfig,
    ...Object.fromEntries(snapshotTables.map((table, index) => [table, rows[index]])),
  } as LocalSnapshot;
}

export async function exportLocalDatabase(): Promise<Blob> {
  const snapshot = await loadLocalSnapshot();
  const pin = await localDb.settings.get("pin");
  return new Blob([JSON.stringify({ version: 1, snapshot, pin }, null, 2)], {
    type: "application/json",
  });
}

export async function importLocalDatabase(file: Blob): Promise<void> {
  const parsed = JSON.parse(await file.text()) as {
    version?: number;
    snapshot?: LocalSnapshot | null;
    pin?: LocalSetting;
  };
  if (parsed.version !== 1 || !parsed.snapshot) {
    throw new Error("Unsupported or incomplete backup file");
  }
  await saveLocalSnapshot(parsed.snapshot);
  if (parsed.pin) await localDb.settings.put(parsed.pin);
}
