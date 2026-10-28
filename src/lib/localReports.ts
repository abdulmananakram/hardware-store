import { localDb } from "./localDb";
import { round2 } from "./business";

export type LocalReportKind = "sales" | "stock" | "udhaar" | "profit";

const inRange = (value: string, from?: string, to?: string) => {
  const time = new Date(value).getTime();
  return (!from || time >= new Date(`${from}T00:00:00`).getTime()) &&
    (!to || time <= new Date(`${to}T23:59:59.999`).getTime());
};

export async function getLocalReport(kind: LocalReportKind, from?: string, to?: string) {
  if (kind === "sales" || kind === "profit") {
    const bills = (await localDb.saleBills.toArray()).filter((bill) => inRange(bill.billDate, from, to));
    const returns = await localDb.returns.toArray();
    const active = bills.filter((bill) => !bill.cancelled);
    const rows = active.flatMap((bill) => bill.lines.map((line) => {
      const returned = returns.filter((entry) => entry.saleBillLineId === line.id).reduce((sum, entry) => sum + entry.refundAmount, 0);
      const revenue = round2(line.lineTotal - returned);
      const cogs = round2(line.qtyInBaseUnit * (line.costSnapshot ?? 0));
      return { billId: bill.id, lineId: line.id, revenue, cogs, estimated: Boolean(line.isEstimatedWeight), incompleteCost: line.costSnapshot === undefined };
    }));
    if (kind === "sales") return { kind, bills: active, cancellations: bills.filter((bill) => bill.cancelled), total: round2(rows.reduce((sum, row) => sum + row.revenue, 0)), rows, note: "Cancelled bills are excluded from sales and listed under cancellations. Returns are deducted. Credit sales are included in sales but not cash." };
    return { kind, rows, revenue: round2(rows.reduce((sum, row) => sum + row.revenue, 0)), grossProfit: round2(rows.reduce((sum, row) => sum + row.revenue - row.cogs, 0)), estimated: rows.some((row) => row.estimated || row.incompleteCost), note: "COGS uses the sale-time cost snapshot; later purchases do not rewrite past profit. Gross profit excludes expenses." };
  }
  if (kind === "stock") {
    const [items, movements] = await Promise.all([localDb.items.toArray(), localDb.inventoryMovements.toArray()]);
    const active = items.filter((item) => item.isActive);
    return { kind, items: active, movements: movements.filter((movement) => inRange(movement.createdAt, from, to)), valuation: round2(active.reduce((sum, item) => sum + item.qtyInBaseUnit * (item.costPerBaseUnit ?? 0), 0)), note: "Stock is valued at the current weighted-average cost. Movement history is the inventory ledger." };
  }
  const [customers, suppliers, transactions] = await Promise.all([localDb.customers.toArray(), localDb.suppliers.toArray(), localDb.khataTransactions.toArray()]);
  return { kind, customers, suppliers, transactions: transactions.filter((transaction) => inRange(transaction.transactionDate, from, to)), note: "Customer receivables and supplier payables are shown separately. Payments and return credits reduce balances." };
}
