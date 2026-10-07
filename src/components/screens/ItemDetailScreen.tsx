"use client";

import { useApp, fmtRs, stockDisplay, fmtDate } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function ItemDetailScreen() {
  const params = useApp((s) => s.params);
  const items = useApp((s) => s.items);
  const categories = useApp((s) => s.categories);
  const stockAdjustments = useApp((s) => s.stockAdjustments);
  const rateHistory = useApp((s) => s.rateHistory);
  const saleBills = useApp((s) => s.saleBills);
  const purchaseBills = useApp((s) => s.purchaseBills);
  const navigate = useApp((s) => s.navigate);

  const item = params.itemId ? items.find((i) => i.id === params.itemId) : null;
  if (!item) {
    return (
      <div className="p-6 text-center text-slate-500">
        Item not found.{" "}
        <button onClick={() => navigate("inventory")} className="text-teal-700 font-bold">
          Back
        </button>
      </div>
    );
  }

  const cat = categories.find((c) => c.id === item.categoryId);
  const low = item.qtyInBaseUnit <= item.lowStockThreshold;
  const adjustments = stockAdjustments
    .filter((a) => a.itemId === item.id)
    .sort((a, b) => new Date(b.adjustedAt).getTime() - new Date(a.adjustedAt).getTime());
  const history = rateHistory.filter((h) => h.itemId === item.id);
  const recentSaleBills = saleBills
    .filter((b) => b.lines.some((l) => l.itemId === item.id))
    .slice(0, 5);
  const recentPurchaseBills = purchaseBills
    .filter((b) => b.lines.some((l) => l.itemId === item.id))
    .slice(0, 5);

  return (
    <div className="px-3 pt-3 pb-28 space-y-3">
      {/* Hero */}
      <div
        className={`rounded-2xl p-4 shadow-lg text-white ${
          low
            ? "bg-gradient-to-br from-rose-500 to-rose-700"
            : "bg-gradient-to-br from-teal-600 to-teal-700"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center text-4xl">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-lg leading-tight truncate">{item.name}</p>
            {item.urduName && (
              <p className="text-sm opacity-80" dir="rtl">
                {item.urduName}
              </p>
            )}
            <p className="text-[11px] opacity-80 mt-1">
              {cat?.icon} {cat?.name}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-[10px] uppercase opacity-80 font-bold">Price</p>
            <p className="font-bold text-sm">{fmtRs(item.pricePerBaseUnit)}</p>
            <p className="text-[9px] opacity-70">per {item.baseUnitName}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-[10px] uppercase opacity-80 font-bold">Stock</p>
            <p className="font-bold text-sm">{stockDisplay(item)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-[10px] uppercase opacity-80 font-bold">Cost</p>
            <p className="font-bold text-sm">
              {item.costPerBaseUnit ? fmtRs(item.costPerBaseUnit) : "—"}
            </p>
            <p className="text-[9px] opacity-70">per {item.baseUnitName}</p>
          </div>
        </div>
        {low && (
          <div className="mt-2 bg-white/20 rounded-lg p-2 text-center text-xs font-bold">
            ⚠ Low stock — at or below threshold of {item.lowStockThreshold} {item.baseUnitName}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={() => navigate("item-edit", { itemId: item.id })}
          className="bg-teal-600 hover:bg-teal-500 font-bold h-12"
        >
          ✏️ Edit
        </Button>
        <Button
          onClick={() => navigate("stock-adjust", { itemId: item.id })}
          className="bg-amber-600 hover:bg-amber-500 font-bold h-12"
        >
          ⚖️ Adjust
        </Button>
        <Button
          onClick={() => navigate("sale-new")}
          className="bg-emerald-600 hover:bg-emerald-500 font-bold h-12"
        >
          🧾 Sell
        </Button>
      </div>

      {/* Units */}
      <div>
        <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">Units</h3>
        <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100">
          {item.units.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-3 py-2.5">
              <div>
                <span className="font-semibold text-sm">{u.unitName}</span>
                {u.isBaseUnit && (
                  <span className="ml-2 text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-bold">
                    BASE
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">
                {u.isBaseUnit
                  ? "1 = 1 base"
                  : `1 ${u.unitName} = ${u.conversionToBase} ${item.baseUnitName}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Adjustment history */}
      <div>
        <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">
          Stock Adjustments ({adjustments.length})
        </h3>
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {adjustments.length === 0 && (
            <p className="p-4 text-center text-slate-500 text-sm">
              No adjustments. Use ⚖️ Adjust to restock, log damage, or correct counts.
            </p>
          )}
          {adjustments.slice(0, 5).map((a) => {
            const positive = a.deltaInBaseUnit > 0;
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                    positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {positive ? "↗" : "↙"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm capitalize">
                    {a.type.replace("_", " ")}
                    {a.reason && <span className="text-[11px] text-slate-500"> — {a.reason}</span>}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {fmtDate(a.adjustedAt)} • New: {a.newQtyInBaseUnit} {item.baseUnitName}
                  </p>
                </div>
                <p
                  className={`font-bold text-sm ${
                    positive ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {positive ? "+" : ""}
                  {a.deltaInBaseUnit}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Price history */}
      {history.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">
            Price History
          </h3>
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {history.slice(0, 5).map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0"
              >
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm">
                  ₹
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {fmtRs(h.oldPrice)} → <b>{fmtRs(h.newPrice)}</b>
                  </p>
                  <p className="text-[11px] text-slate-500">{fmtDate(h.changedAt)}</p>
                </div>
                <p className="text-xs font-bold text-amber-700">
                  {h.newPrice > h.oldPrice ? "↑" : "↓"}{" "}
                  {Math.abs(((h.newPrice - h.oldPrice) / h.oldPrice) * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {(recentSaleBills.length > 0 || recentPurchaseBills.length > 0) && (
        <div>
          <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">
            Recent Activity
          </h3>
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {recentSaleBills.map((b) => {
              const line = b.lines.find((l) => l.itemId === item.id)!;
              return (
                <div
                  key={`s-${b.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100"
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
                    ↓
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Sold — Bill #{b.id}</p>
                    <p className="text-[11px] text-slate-500">
                      {fmtDate(b.billDate)} • {line.qtyInSoldUnit} units
                    </p>
                  </div>
                  <p className="text-sm font-bold text-rose-600">−{line.qtyInBaseUnit}</p>
                </div>
              );
            })}
            {recentPurchaseBills.map((b) => {
              const line = b.lines.find((l) => l.itemId === item.id)!;
              return (
                <div
                  key={`p-${b.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0"
                >
                  <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm">
                    ↑
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Purchased — Bill #{b.id}</p>
                    <p className="text-[11px] text-slate-500">
                      {fmtDate(b.billDate)} • {line.qtyInPurchasedUnit} units @ {fmtRs(line.unitCost)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600">+{line.qtyInBaseUnit}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
