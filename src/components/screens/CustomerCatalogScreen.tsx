"use client";

import { useState, useMemo } from "react";
import { useApp, fmtRs } from "@/lib/store";
import { Input } from "@/components/ui/input";

export function CustomerCatalogScreen() {
  const items = useApp((s) => s.items);
  const categories = useApp((s) => s.categories);

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.isActive);
    if (activeCat) list = list.filter((i) => i.categoryId === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeCat, query]);

  return (
    <div className="px-3 pt-3 pb-28">
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-3">
        <p className="text-sm font-bold text-teal-800">🛍️ Customer Price List</p>
        <p className="text-xs text-teal-700 mt-0.5">
          Show this to your customers. Stock numbers are hidden on this view.
        </p>
      </div>

      <div className="relative mb-2">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search price list…"
          className="pl-10 h-11 bg-white border-slate-200"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-3 px-3">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
            !activeCat
              ? "bg-teal-50 border-teal-500 text-teal-700"
              : "bg-white border-slate-200 text-slate-600"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id === activeCat ? null : c.id)}
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

      <div className="grid grid-cols-2 gap-2">
        {filtered.map((it) => (
          <div
            key={it.id}
            className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center"
          >
            <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center text-4xl mb-1.5">
              {it.icon}
            </div>
            <p className="font-bold text-sm leading-tight truncate">{it.name}</p>
            <p className="text-[10px] text-slate-500">{it.baseUnitName}</p>
            <p className="text-lg font-extrabold text-teal-700 mt-0.5">
              {fmtRs(it.pricePerBaseUnit)}
            </p>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-10">No items</p>
      )}
    </div>
  );
}
