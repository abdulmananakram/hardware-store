"use client";

import { useApp, fmtRs, fmtDate } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function DashboardScreen() {
  const saleBills = useApp((s) => s.saleBills);
  const items = useApp((s) => s.items);
  const customers = useApp((s) => s.customers);
  const suppliers = useApp((s) => s.suppliers);
  const notifications = useApp((s) => s.notifications);
  const navigate = useApp((s) => s.navigate);
  const getCustomer = useApp((s) => s.getCustomer);
  const language = useApp((s) => s.shopConfig.language ?? "en");
  const updateShopConfig = useApp((s) => s.updateShopConfig);

  // Today's total sales (only non-cancelled, today's date)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysSales = saleBills.filter(
    (b) => !b.cancelled && new Date(b.billDate) >= todayStart
  );
  const todayTotal = todaysSales.reduce((s, b) => s + b.totalAmount, 0);

  const lowStockItems = items.filter(
    (i) => i.isActive && i.qtyInBaseUnit <= i.lowStockThreshold
  );

  const totalReceivable = customers
    .filter((c) => c.khataBalance > 0)
    .reduce((s, c) => s + c.khataBalance, 0);
  const totalPayable = suppliers
    .filter((sp) => sp.payableBalance > 0)
    .reduce((s, sp) => s + sp.payableBalance, 0);
  const unreadNotifs = notifications.filter((n) => !n.isRead).length;

  const recentBills = saleBills.slice(0, 5);

  return (
    <div className="px-3 pt-3 pb-28 space-y-3">
      <div className="flex justify-end">
        <button onClick={() => updateShopConfig({ language: language === "en" ? "ur" : "en" })} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold shadow-sm border">
          {language === "en" ? t("urdu", language) : t("english", language)}
        </button>
      </div>
      {/* Hero — New Sale Bill */}
      <button
        onClick={() => navigate("sale-new")}
        className="w-full bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-2xl p-4 shadow-lg active:scale-[0.98] transition text-left"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl">🧾</div>
            <h2 className="text-lg font-extrabold mt-1">{t("newSaleBill", language)}</h2>
            <p className="text-teal-100 text-xs">Tap to start billing in seconds</p>
          </div>
          <div className="text-4xl">→</div>
        </div>
      </button>

      {/* Today's sales */}
      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wide">
              Today's Sales
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-0.5">
              {fmtRs(todayTotal)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-teal-700">{todaysSales.length}</p>
            <p className="text-[11px] text-slate-500">bills today</p>
          </div>
        </div>
      </Card>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate("inventory", { filterType: undefined })}
          className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-left active:scale-95 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span className="text-[11px] font-bold uppercase text-slate-500">
              Low Stock
            </span>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">
            {lowStockItems.length}
          </p>
          <p className="text-[11px] text-slate-500">items need reorder</p>
        </button>

        <button
          onClick={() => navigate("customers")}
          className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-left active:scale-95 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">📒</span>
            <span className="text-[11px] font-bold uppercase text-slate-500">
              Receivable
            </span>
          </div>
          <p className="text-xl font-extrabold text-rose-600 mt-1">
            {fmtRs(totalReceivable)}
          </p>
          <p className="text-[11px] text-slate-500">customer khata</p>
        </button>

        <button
          onClick={() => navigate("suppliers")}
          className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-left active:scale-95 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🚚</span>
            <span className="text-[11px] font-bold uppercase text-slate-500">
              Payable
            </span>
          </div>
          <p className="text-xl font-extrabold text-orange-600 mt-1">
            {fmtRs(totalPayable)}
          </p>
          <p className="text-[11px] text-slate-500">to suppliers</p>
        </button>

        <button
          onClick={() => navigate("notifications")}
          className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-left active:scale-95 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <span className="text-[11px] font-bold uppercase text-slate-500">
              Alerts
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {unreadNotifs}
          </p>
          <p className="text-[11px] text-slate-500">unread</p>
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        <Button
          variant="outline"
          onClick={() => navigate("purchase-new")}
          className="h-auto py-3 flex flex-col gap-1 border-slate-200"
        >
          <span className="text-xl">🚚</span>
          <span className="text-[11px] font-semibold">Purchase</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("bill-history", { filterType: "sales" })}
          className="h-auto py-3 flex flex-col gap-1 border-slate-200"
        >
          <span className="text-xl">📜</span>
          <span className="text-[11px] font-semibold">History</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("customer-catalog")}
          className="h-auto py-3 flex flex-col gap-1 border-slate-200"
        >
          <span className="text-xl">🛍️</span>
          <span className="text-[11px] font-semibold">Price List</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("reports")}
          className="h-auto py-3 flex flex-col gap-1 border-slate-200"
        >
          <span className="text-xl">📊</span>
          <span className="text-[11px] font-semibold">Reports</span>
        </Button>
      </div>

      {/* Recent bills */}
      <div>
        <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-wide mt-3 mb-2">
          Recent Bills
        </h3>
        <Card className="p-0 overflow-hidden">
          {recentBills.length === 0 && (
            <p className="p-4 text-sm text-slate-500 text-center">No bills yet</p>
          )}
          {recentBills.map((b) => {
            const cust = getCustomer(b.customerId || -1);
            return (
              <button
                key={b.id}
                onClick={() => navigate("bill-history", { filterType: "sales" })}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition text-left"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    b.paymentType === "cash"
                      ? "bg-emerald-100"
                      : "bg-amber-100"
                  }`}
                >
                  {b.paymentType === "cash" ? "💵" : "📒"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {cust?.name || "Walk-in Customer"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {fmtDate(b.billDate)} • {b.lines.length} items
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-sm">{fmtRs(b.totalAmount)}</p>
                  {b.syncStatus === "pending" && (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      ☁ PENDING
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
