import { localDb } from "./localDb";
import { round2 } from "./business";
import type { AppNotification } from "./types";

export async function generateLocalNotifications(): Promise<number> {
  return localDb.transaction("rw", [localDb.items, localDb.customers, localDb.saleBills, localDb.notifications, localDb.settings], async () => {
    const [items, customers, bills, existing] = await Promise.all([
      localDb.items.toArray(), localDb.customers.toArray(), localDb.saleBills.toArray(), localDb.notifications.toArray(),
    ]);
    const created: AppNotification[] = [];
    const ts = new Date().toISOString();
    for (const item of items.filter((candidate) => candidate.isActive && candidate.qtyInBaseUnit <= candidate.lowStockThreshold)) {
      if (!existing.some((notification) => notification.type === "low_stock" && notification.relatedItemId === item.id && !notification.isRead)) {
        created.push({ id: Date.now() + created.length, shopId: 1, type: "low_stock" as const, message: `${item.name} is low on stock (${item.qtyInBaseUnit} ${item.baseUnitName} left)`, relatedItemId: item.id, isRead: false, createdAt: ts });
      }
    }
    const config = (await localDb.settings.get("shopConfig"))?.value as { khataReminderThresholdAmount?: number; khataReminderThresholdDays?: number } | undefined;
    const threshold = config?.khataReminderThresholdAmount ?? 1000;
    const ageDays = config?.khataReminderThresholdDays ?? 7;
    for (const customer of customers.filter((candidate) => candidate.khataBalance >= threshold)) {
      const old = bills.filter((bill) => bill.customerId === customer.id && !bill.cancelled && (bill.outstandingAmount ?? 0) > 0).sort((a, b) => a.id - b.id)[0];
      if (!old || Date.now() - new Date(old.billDate).getTime() < ageDays * 86400000) continue;
      if (!existing.some((notification) => notification.type === "khata_reminder" && notification.relatedCustomerId === customer.id && !notification.isRead)) {
        created.push({ id: Date.now() + created.length, shopId: 1, type: "khata_reminder" as const, message: `${customer.name} owes Rs. ${round2(customer.khataBalance)}`, relatedCustomerId: customer.id, isRead: false, createdAt: ts });
      }
    }
    if (created.length) await localDb.notifications.bulkAdd(created);
    return created.length;
  });
}
