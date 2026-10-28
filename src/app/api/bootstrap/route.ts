import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const [
    shopConfig,
    categories,
    items,
    customers,
    suppliers,
    saleBills,
    purchaseBills,
    returns,
    khataTransactions,
    notifications,
    rateHistory,
    stockAdjustments,
    inventoryMovements,
    auditLogs,
  ] = await Promise.all([
    db.shopConfig.findFirst(),
    db.category.findMany({ include: { images: true }, orderBy: { name: "asc" } }),
    db.item.findMany({ include: { units: true }, orderBy: { name: "asc" } }),
    db.customer.findMany({ orderBy: { name: "asc" } }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.saleBill.findMany({ include: { lines: true }, orderBy: { billDate: "desc" } }),
    db.purchaseBill.findMany({ include: { lines: true }, orderBy: { billDate: "desc" } }),
    db.return.findMany({ orderBy: { returnDate: "desc" } }),
    db.khataTransaction.findMany({ orderBy: { transactionDate: "desc" } }),
    db.appNotification.findMany({ orderBy: { createdAt: "desc" } }),
    db.rateHistory.findMany({ orderBy: { changedAt: "desc" } }),
    db.stockAdjustment.findMany({ orderBy: { adjustedAt: "desc" } }),
    db.inventoryMovement.findMany({ orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({
    shopConfig: shopConfig ?? {
      shopId: 1,
      shopName: "Hardware Shop",
      itemDeletionWindowDays: 90,
      lowStockThresholdDefault: 10,
      baseUnitDefault: "Piece",
      khataReminderThresholdDays: 7,
      khataReminderThresholdAmount: 1000,
    },
    categories,
    items,
    customers,
    suppliers,
    saleBills,
    purchaseBills,
    returns,
    khataTransactions,
    notifications,
    rateHistory,
    stockAdjustments,
    inventoryMovements,
    auditLogs,
    categoryImages: categories.flatMap((category) => category.images),
    aiSessions: [],
  });
}

