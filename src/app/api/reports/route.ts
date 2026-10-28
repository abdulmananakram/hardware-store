import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/server/auth";

const range = (request: NextRequest) => {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
};

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const kind = new URL(request.url).searchParams.get("kind") ?? "sales";
  const dates = range(request);
  if (kind === "sales") {
    const bills = await db.saleBill.findMany({ where: { billDate: dates }, include: { lines: true }, orderBy: { billDate: "desc" } });
    return NextResponse.json({ kind, bills, total: bills.filter((b) => !b.cancelled).reduce((sum, b) => sum + b.totalAmount, 0) });
  }
  if (kind === "stock") {
    const [items, movements] = await Promise.all([
      db.item.findMany({ where: { isActive: true }, include: { units: true, category: true } }),
      db.inventoryMovement.findMany({ where: { createdAt: dates }, orderBy: { createdAt: "asc" } }),
    ]);
    return NextResponse.json({ kind, items, movements, valuation: items.reduce((sum, item) => sum + item.qtyInBaseUnit * (item.costPerBaseUnit ?? 0), 0) });
  }
  if (kind === "udhaar") {
    const [customers, suppliers, transactions] = await Promise.all([
      db.customer.findMany({ orderBy: { name: "asc" } }),
      db.supplier.findMany({ orderBy: { name: "asc" } }),
      db.khataTransaction.findMany({ where: { transactionDate: dates }, orderBy: { transactionDate: "asc" } }),
    ]);
    return NextResponse.json({ kind, customers, suppliers, transactions });
  }
  if (kind === "profit") {
    const bills = await db.saleBill.findMany({ where: { billDate: dates }, include: { lines: true } });
    const rows = bills.filter((b) => !b.cancelled).flatMap((bill) => bill.lines.map((line) => ({
      billId: bill.id,
      lineId: line.id,
      revenue: line.lineTotal,
      cogs: line.qtyInBaseUnit * (line.costSnapshot ?? 0),
      estimated: line.isEstimatedWeight,
    })));
    return NextResponse.json({ kind, rows, revenue: rows.reduce((s, r) => s + r.revenue, 0), grossProfit: rows.reduce((s, r) => s + r.revenue - r.cogs, 0), estimated: rows.some((r) => r.estimated) });
  }
  return NextResponse.json({ error: true, message: "Unknown report kind" }, { status: 400 });
}
