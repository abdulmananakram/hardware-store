"use client";

import { useState, useMemo } from "react";
import { useApp, fmtRs, stockDisplay } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function InventoryScreen() {
  const items = useApp((s) => s.items);
  const categories = useApp((s) => s.categories);
  const navigate = useApp((s) => s.navigate);

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.isActive);
    if (activeCat) list = list.filter((i) => i.categoryId === activeCat);
    if (lowOnly) list = list.filter((i) => i.qtyInBaseUnit <= i.lowStockThreshold);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.urduName || "").includes(query)
      );
    }
    return list;
  }, [items, activeCat, query, lowOnly]);

  return (
    <div className="px-3 pt-3 pb-28">
      {/* Search */}
      <div className="relative mb-2">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item name…"
          className="pl-10 h-11 bg-white border-slate-200"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-3 px-3">
        <button
          onClick={() => {
            setActiveCat(null);
            setLowOnly(false);
          }}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
            !activeCat && !lowOnly
              ? "bg-teal-50 border-teal-500 text-teal-700"
              : "bg-white border-slate-200 text-slate-600"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setLowOnly(!lowOnly)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
            lowOnly
              ? "bg-rose-50 border-rose-500 text-rose-700"
              : "bg-white border-slate-200 text-slate-600"
          }`}
        >
          ⚠ Low Stock
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setActiveCat(c.id === activeCat ? null : c.id);
              setLowOnly(false);
            }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
              activeCat === c.id
                ? "bg-teal-50 border-teal-500 text-teal-700"
                : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Add Item / AI Import buttons */}
      <div className="grid grid-cols-2 gap-2 my-3">
        <Button
          onClick={() => navigate("item-add")}
          className="bg-teal-600 hover:bg-teal-500 font-bold h-11"
        >
          ➕ Add Item
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("ai-import-list")}
          className="border-slate-200 font-bold h-11"
        >
          🤖 AI Import
        </Button>
      </div>

      {/* Item list */}
      <div className="space-y-1.5">
        {filtered.map((it) => {
          const cat = categories.find((c) => c.id === it.categoryId);
          const low = it.qtyInBaseUnit <= it.lowStockThreshold;
          return (
            <button
              key={it.id}
              onClick={() => navigate("item-detail", { itemId: it.id })}
              className={`w-full bg-white rounded-xl p-3 shadow-sm border flex items-center gap-3 active:scale-[0.98] transition text-left ${
                low ? "border-rose-200 bg-rose-50/30" : "border-slate-100"
              }`}
            >
              <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center text-2xl shrink-0">
                {it.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{it.name}</p>
                <p className="text-[11px] text-slate-500">
                  {cat?.name} • {fmtRs(it.pricePerBaseUnit)}/{it.baseUnitName}
                </p>
                <p className={`text-[11px] font-semibold ${low ? "text-rose-600" : "text-slate-600"}`}>
                  Stock: {stockDisplay(it)} {low && "⚠"}
                </p>
              </div>
              <span className="text-slate-300 text-lg">›</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">📦</p>
            <p className="text-slate-500 text-sm">No items match</p>
          </div>
        )}
      </div>
    </div>
  );
}
