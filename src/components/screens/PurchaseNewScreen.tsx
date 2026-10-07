"use client";

import { useState, useMemo } from "react";
import { useApp, fmtRs, stockDisplay } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/parts/Sheet";

export function PurchaseNewScreen() {
  const items = useApp((s) => s.items);
  const suppliers = useApp((s) => s.suppliers);
  const draftPurchase = useApp((s) => s.draftPurchase);
  const draftPurchaseAddLine = useApp((s) => s.draftPurchaseAddLine);
  const draftPurchaseRemoveLine = useApp((s) => s.draftPurchaseRemoveLine);
  const draftPurchaseSetSupplier = useApp((s) => s.draftPurchaseSetSupplier);
  const draftPurchaseSetPayment = useApp((s) => s.draftPurchaseSetPayment);
  const draftPurchaseTotal = useApp((s) => s.draftPurchaseTotal);
  const commitPurchase = useApp((s) => s.commitPurchase);
  const addSupplier = useApp((s) => s.addSupplier);
  const navigate = useApp((s) => s.navigate);

  const [query, setQuery] = useState("");
  const [pickItem, setPickItem] = useState<number | null>(null);
  const [qty, setQty] = useState("");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [unitCost, setUnitCost] = useState("");
  const [showBill, setShowBill] = useState(false);
  const [showNewSup, setShowNewSup] = useState(false);
  const [newSupName, setNewSupName] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");
  const [done, setDone] = useState<null | { id: number; total: number }>(null);

  const filteredItems = useMemo(() => {
    let list = items.filter((i) => i.isActive);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, query]);

  const total = draftPurchaseTotal();

  const handleAddLine = () => {
    if (!pickItem || !unitId || !qty || !unitCost) return;
    draftPurchaseAddLine(pickItem, unitId, parseFloat(qty), parseFloat(unitCost));
    setPickItem(null);
    setQty("");
    setUnitId(null);
    setUnitCost("");
  };

  const handleConfirm = () => {
    const bill = commitPurchase();
    setShowBill(false);
    setDone({ id: bill.id, total: bill.totalAmount });
  };

  return (
    <div className="pb-56">
      {/* Supplier picker */}
      <div className="px-3 pt-3 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase text-slate-500">Supplier</p>
          <button
            onClick={() => setShowNewSup(true)}
            className="text-[11px] font-bold text-teal-700 hover:underline"
          >
            + New supplier
          </button>
        </div>
        <select
          value={draftPurchase.supplierId || ""}
          onChange={(e) => draftPurchaseSetSupplier(e.target.value ? +e.target.value : null)}
          className="w-full mt-1 mb-2 p-2.5 border-2 border-slate-200 rounded-lg bg-white font-semibold text-sm"
        >
          <option value="">— Select supplier —</option>
          {suppliers.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name} {sp.phone ? `(${sp.phone})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="sticky top-[58px] z-20 bg-[#f1f5f4] px-3 pt-2 pb-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item to add…"
            className="pl-10 h-11 bg-white border-slate-200"
          />
        </div>
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-2 pb-4">
        {filteredItems.map((it) => (
          <button
            key={it.id}
            onClick={() => {
              setPickItem(it.id);
              setUnitId(it.units[0].id);
              setQty("");
              setUnitCost(it.costPerBaseUnit ? String(it.costPerBaseUnit) : "");
            }}
            className="bg-white rounded-xl p-2 shadow-sm border border-slate-100 text-left active:scale-95 transition"
          >
            <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center text-3xl mb-1.5">
              {it.icon}
            </div>
            <p className="text-[12px] font-bold leading-tight truncate">{it.name}</p>
            <p className="text-[10px] text-slate-500">Stock: {stockDisplay(it)}</p>
            {it.costPerBaseUnit && (
              <p className="text-[10px] text-slate-400">Last cost: {fmtRs(it.costPerBaseUnit)}</p>
            )}
          </button>
        ))}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-slate-900 text-white z-30 rounded-t-2xl">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400">
              {draftPurchase.lines.length} items
              {draftPurchase.paymentType === "udhaar" && draftPurchase.supplierId && (
                <span className="ml-1 text-amber-400">• Udhaar</span>
              )}
            </p>
            <p className="text-xl font-extrabold">{fmtRs(total)}</p>
          </div>
          <Button
            onClick={() => setShowBill(true)}
            disabled={draftPurchase.lines.length === 0 || !draftPurchase.supplierId}
            className="bg-teal-600 hover:bg-teal-500 font-extrabold px-5 h-12"
          >
            🚚 Review
          </Button>
        </div>
      </div>

      {/* Item picker */}
      <Sheet
        open={pickItem !== null}
        onClose={() => setPickItem(null)}
        title={pickItem ? items.find((i) => i.id === pickItem)?.name : ""}
      >
        {pickItem && (
          <div>
            {(() => {
              const item = items.find((i) => i.id === pickItem)!;
              const unit = item.units.find((u) => u.id === unitId);
              const qtyNum = parseFloat(qty) || 0;
              const costNum = parseFloat(unitCost) || 0;
              const totalLine = unit
                ? Math.round(qtyNum * unit.conversionToBase * costNum * 100) / 100
                : 0;
              return (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-4xl">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        Current stock: {stockDisplay(item)}
                      </p>
                      {item.costPerBaseUnit && (
                        <p className="text-xs text-slate-400">
                          Last cost: {fmtRs(item.costPerBaseUnit)}/{item.baseUnitName}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">Unit</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.units.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setUnitId(u.id)}
                        className={`px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition ${
                          unitId === u.id
                            ? "bg-teal-50 border-teal-500 text-teal-700"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        {u.unitName}
                        {u.conversionToBase > 1 && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            = {u.conversionToBase} {item.baseUnitName}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">Quantity</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="0"
                        className="h-12 text-xl font-bold"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Cost per {unit?.unitName || "unit"}
                      </p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={unitCost}
                        onChange={(e) => setUnitCost(e.target.value)}
                        placeholder="0"
                        className="h-12 text-xl font-bold"
                      />
                    </div>
                  </div>

                  {/* Per resolution #5 — show derived cost per base unit */}
                  {unit && unitCost && parseFloat(unitCost) > 0 && unit.conversionToBase > 1 && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      = <b>Rs. {((parseFloat(unitCost) || 0) / unit.conversionToBase).toFixed(2)}</b> per {item.baseUnitName} (auto-derived)
                    </p>
                  )}

                  <div className="mt-3 p-2.5 bg-teal-50 border border-teal-200 rounded-lg flex items-baseline justify-between">
                    <span className="text-sm text-slate-700">Line Total</span>
                    <span className="font-extrabold text-teal-800 text-lg">
                      {fmtRs(totalLine)}
                    </span>
                  </div>

                  <button
                    onClick={handleAddLine}
                    disabled={!qty || !unitCost || parseFloat(qty) <= 0}
                    className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold py-3.5 rounded-xl text-base transition active:scale-95"
                  >
                    + Add to Bill
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </Sheet>

      {/* Review sheet */}
      <Sheet open={showBill} onClose={() => setShowBill(false)} title="Review Purchase">
        <div className="space-y-2">
          {draftPurchase.lines.map((l) => {
            const item = items.find((i) => i.id === l.itemId)!;
            const unit = item.units.find((u) => u.id === l.unitId)!;
            return (
              <div key={l.tempId} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg bg-slate-50">
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {l.qty} {unit.unitName} × {fmtRs(l.unitCost)}
                  </p>
                </div>
                <span className="font-bold text-sm">{fmtRs(l.lineTotal)}</span>
                <button
                  onClick={() => draftPurchaseRemoveLine(l.tempId)}
                  className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {draftPurchase.lines.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">
              Bill is empty. Pick items above.
            </p>
          )}

          {draftPurchase.lines.length > 0 && (
            <>
              <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900">
                <span className="font-bold text-lg">TOTAL</span>
                <span className="font-extrabold text-xl">{fmtRs(total)}</span>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Payment Type
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => draftPurchaseSetPayment("cash")}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-sm transition ${
                      draftPurchase.paymentType === "cash"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    onClick={() => draftPurchaseSetPayment("udhaar")}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-sm transition ${
                      draftPurchase.paymentType === "udhaar"
                        ? "bg-amber-50 border-amber-500 text-amber-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    📒 Udhaar
                  </button>
                </div>
                {draftPurchase.paymentType === "udhaar" && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded-lg">
                    Will add Rs. {total.toLocaleString()} to {suppliers.find((s) => s.id === draftPurchase.supplierId)?.name}&apos;s payable balance.
                  </p>
                )}
              </div>

              <button
                onClick={handleConfirm}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl text-base transition active:scale-95"
              >
                ✔ Save Purchase
              </button>
            </>
          )}
        </div>
      </Sheet>

      {/* New supplier */}
      <Sheet open={showNewSup} onClose={() => setShowNewSup(false)} title="Add New Supplier">
        <div className="space-y-2">
          <Input
            value={newSupName}
            onChange={(e) => setNewSupName(e.target.value)}
            placeholder="Supplier name"
            className="h-11"
          />
          <Input
            value={newSupPhone}
            onChange={(e) => setNewSupPhone(e.target.value)}
            placeholder="Phone (optional)"
            inputMode="tel"
            className="h-11"
          />
          <Button
            onClick={() => {
              if (!newSupName.trim()) return;
              const res = addSupplier(newSupName.trim(), newSupPhone || undefined);
              if (res.supplier) draftPurchaseSetSupplier(res.supplier.id);
              setNewSupName("");
              setNewSupPhone("");
              setShowNewSup(false);
            }}
            className="w-full bg-teal-600 hover:bg-teal-500 font-bold h-11"
          >
            Add Supplier
          </Button>
        </div>
      </Sheet>

      {/* Done */}
      <Sheet open={!!done} onClose={() => { setDone(null); navigate("bill-history", { filterType: "purchases" }); }} title="✅ Purchase Saved">
        {done && (
          <DonePurchaseView billId={done.id} total={done.total} onHistory={() => { setDone(null); navigate("bill-history", { filterType: "purchases" }); }} />
        )}
      </Sheet>
    </div>
  );
}

// Per resolution #1 — live sync status display for purchase
function DonePurchaseView({
  billId,
  total,
  onHistory,
}: {
  billId: number;
  total: number;
  onHistory: () => void;
}) {
  const syncStatus = useApp((s) => s.purchaseBills.find((b) => b.id === billId)?.syncStatus || "pending");
  const isOnline = useApp((s) => s.isOnline);
  return (
    <div className="text-center py-2">
      <div className="text-5xl mb-2">✅</div>
      <p className="font-extrabold text-lg">Purchase #{billId} saved</p>
      <p className="text-3xl font-extrabold text-slate-900 mt-2">{fmtRs(total)}</p>
      {syncStatus === "synced" ? (
        <p className="text-xs text-emerald-600 mt-2 bg-emerald-50 inline-block px-3 py-1 rounded-full font-bold">
          ✓ Synced to cloud
        </p>
      ) : syncStatus === "syncing" ? (
        <p className="text-xs text-blue-600 mt-2 bg-blue-50 inline-block px-3 py-1 rounded-full font-bold">
          ⟳ Syncing to cloud…
        </p>
      ) : (
        <p className="text-xs text-amber-600 mt-2 bg-amber-50 inline-block px-3 py-1 rounded-full font-bold">
          {isOnline ? "☁ Queued — will upload shortly" : "📵 Offline — will upload when back online"}
        </p>
      )}
      <Button
        onClick={onHistory}
        className="w-full mt-5 bg-teal-600 hover:bg-teal-500 font-bold h-11"
      >
        📜 View History
      </Button>
    </div>
  );
}
