"use client";

import { useState, useMemo } from "react";
import { useApp, fmtRs, stockDisplay } from "@/lib/store";
import { ItemGridImage } from "@/components/parts/ItemImage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/parts/Sheet";
import { PaymentType } from "@/lib/types";

export function SaleNewScreen() {
  const items = useApp((s) => s.items);
  const categories = useApp((s) => s.categories);
  const draftSale = useApp((s) => s.draftSale);
  const draftSaleAddLine = useApp((s) => s.draftSaleAddLine);
  const draftSaleRemoveLine = useApp((s) => s.draftSaleRemoveLine);
  const draftSaleSetCustomer = useApp((s) => s.draftSaleSetCustomer);
  const draftSaleSetPayment = useApp((s) => s.draftSaleSetPayment);
  const draftSaleTotal = useApp((s) => s.draftSaleTotal);
  const commitSale = useApp((s) => s.commitSale);
  const navigate = useApp((s) => s.navigate);
  const customers = useApp((s) => s.customers);
  const addCustomer = useApp((s) => s.addCustomer);

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [pickItem, setPickItem] = useState<number | null>(null);
  const [saleMode, setSaleMode] = useState<"qty" | "amount">("qty");
  const [qty, setQty] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [estAmount, setEstAmount] = useState("100");
  const [estRatePerKg, setEstRatePerKg] = useState("450");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [showBill, setShowBill] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [paid, setPaid] = useState("");
  const [doneBill, setDoneBill] = useState<null | { id: number; total: number }>(null);

  const filteredItems = useMemo(() => {
    let list = items.filter((i) => i.isActive);
    if (activeCat) list = list.filter((i) => i.categoryId === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.urduName || "").includes(query) ||
          i.baseUnitName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeCat, query]);

  const total = draftSaleTotal();

  const handleAdd = () => {
    if (!pickItem || !unitId) return;
    if (saleMode === "amount") {
      const amtNum = parseFloat(estAmount);
      const rateNum = parseFloat(estRatePerKg);
      if (!amtNum || amtNum <= 0 || !rateNum || rateNum <= 0) {
        setErr("Enter valid amount and rate per kg");
        return;
      }
      const res = draftSaleAddLine(pickItem, unitId, 0, undefined, {
        saleAmount: amtNum,
        ratePerKg: rateNum,
      });
      if (!res.ok) {
        setErr(res.error || "Cannot add");
        return;
      }
    } else {
      const qtyNum = parseFloat(qty);
      if (!qtyNum || qtyNum <= 0) {
        setErr("Enter valid quantity");
        return;
      }
      const customPriceNum = customPrice.trim() ? parseFloat(customPrice) : undefined;
      const res = draftSaleAddLine(pickItem, unitId, qtyNum, customPriceNum);
      if (!res.ok) {
        setErr(res.error || "Cannot add");
        return;
      }
    }
    setPickItem(null);
    setQty("");
    setCustomPrice("");
    setUnitId(null);
    setErr("");
  };

  const handleConfirmPay = () => {
    const bill = commitSale();
    setShowPay(false);
    setShowBill(false);
    setPaid("");
    setDoneBill({ id: bill.id, total: bill.totalAmount });
  };

  // Reset done toast
  const closeDone = () => {
    setDoneBill(null);
    navigate("bill-history", { filterType: "sales" });
  };

  return (
    <div className="pb-56">
      {/* Search bar — sticky under top */}
      <div className="sticky top-[58px] z-20 bg-[#f1f5f4] px-3 pt-2 pb-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            🔍
          </span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item: nail, screw, lock…"
            className="pl-10 h-11 border-slate-200 bg-white shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-[88px_1fr] gap-2 px-2 pt-1">
        {/* Category rail */}
        <nav className="flex flex-col gap-1.5 sticky top-[120px] max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide pb-2">
          <button
            onClick={() => setActiveCat(null)}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border text-[10px] font-bold transition active:scale-95 ${
              !activeCat
                ? "bg-teal-700 text-white border-teal-700"
                : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            <span className="text-2xl">⭐</span>
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border text-[10px] font-bold transition active:scale-95 ${
                activeCat === c.id
                  ? "bg-teal-700 text-white border-teal-700"
                  : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              {c.icon && c.icon.startsWith("/") ? (
                <img src={c.icon} alt={c.name} className="w-6 h-6 object-contain" />
              ) : (
                <span className="text-2xl">{c.icon}</span>
              )}
              <span className="leading-tight text-center">{c.name}</span>
              {c.urduName && (
                <span className="text-[9px] opacity-70 -mt-0.5">{c.urduName}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Items grid */}
        <div className="grid grid-cols-2 gap-2 pb-4">
          {filteredItems.map((it) => {
            const cat = categories.find((c) => c.id === it.categoryId);
            const low = it.qtyInBaseUnit <= it.lowStockThreshold;
            return (
              <button
                key={it.id}
                onClick={() => {
                  setPickItem(it.id);
                  setUnitId(it.units[0].id);
                  setQty("");
                  setCustomPrice("");
                  setSaleMode("qty");
                  setEstAmount("100");
                  const isKg = it.baseUnitName.toLowerCase() === "kg" || it.baseUnitName.toLowerCase() === "kilogram";
                  const defaultRateKg = isKg ? it.pricePerBaseUnit : Math.round(it.pricePerBaseUnit * 1000);
                  setEstRatePerKg(String(defaultRateKg || 450));
                  setErr("");
                }}
                className="bg-white rounded-xl p-2 shadow-sm border border-slate-100 text-left active:scale-95 transition"
              >
                <div className="aspect-square mb-1.5">
                  <ItemGridImage item={it} rounded="rounded-lg" />
                </div>
                <p className="text-[12px] font-bold leading-tight truncate">{it.name}</p>
                <p className="text-[10px] text-slate-500">{cat?.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[12px] font-extrabold text-teal-700">
                    {fmtRs(it.pricePerBaseUnit)}
                    <span className="text-[9px] text-slate-400 font-normal">
                      /{it.baseUnitName}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 rounded ${
                      low
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {stockDisplay(it)}
                  </span>
                </div>
              </button>
            );
          })}
          {filteredItems.length === 0 && (
            <p className="col-span-2 text-center text-slate-500 text-sm py-10">
              No items found
            </p>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-slate-900 text-white z-30 rounded-t-2xl">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400">
              {draftSale.lines.length} {draftSale.lines.length === 1 ? "item" : "items"} in bill
              {draftSale.paymentType === "udhaar" && draftSale.customerId && (
                <span className="ml-1 text-amber-400">• Udhaar</span>
              )}
            </p>
            <p className="text-xl font-extrabold">{fmtRs(total)}</p>
          </div>
          <Button
            onClick={() => setShowBill(true)}
            disabled={draftSale.lines.length === 0}
            className="bg-teal-600 hover:bg-teal-500 font-extrabold px-5 h-12"
          >
            🧾 View Bill
          </Button>
        </div>
      </div>

      {/* Bill sheet */}
      <Sheet open={showBill} onClose={() => setShowBill(false)} title="Current Bill">
        <div className="space-y-2">
          {draftSale.lines.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">
              Bill is empty. Pick items to add.
            </p>
          )}
          {draftSale.lines.map((l) => {
            const item = items.find((i) => i.id === l.itemId)!;
            const unit = item.units.find((u) => u.id === l.unitId)!;
            return (
              <div
                key={l.tempId}
                className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg bg-slate-50"
              >
                {item.icon && item.icon.startsWith("/") ? (
                  <img src={item.icon} alt={item.name} className="w-7 h-7 object-contain" />
                ) : (
                  <span className="text-2xl">{item.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {l.isEstimatedWeight
                      ? `Est. Weight: ~${l.roundedGrams}g @ ${fmtRs(l.ratePerKg || 0)}/kg`
                      : `${l.qty} ${unit.unitName} × ${fmtRs(l.customUnitPrice ?? item.pricePerBaseUnit)}`}
                    {l.isBelowCost && <span className="text-amber-600 font-bold ml-1.5">⚠ Below Cost</span>}
                  </p>
                </div>
                <span className="font-bold text-sm">{fmtRs(l.lineTotal)}</span>
                <button
                  onClick={() => draftSaleRemoveLine(l.tempId)}
                  className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {draftSale.lines.length > 0 && (
            <>
              <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900">
                <span className="font-bold text-lg">TOTAL</span>
                <span className="font-extrabold text-xl">{fmtRs(total)}</span>
              </div>

              {/* Payment type — per resolution #3: only full-cash or full-udhaar in v1 */}
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase text-slate-500">
                    Payment Type
                  </p>
                  <span className="text-[10px] text-slate-400">
                    v1: full cash or full udhaar only
                  </span>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => draftSaleSetPayment("cash")}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-sm transition ${
                      draftSale.paymentType === "cash"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    💵 Cash
                    <span className="block text-[10px] font-normal text-slate-500">
                      Pay now, full amount
                    </span>
                  </button>
                  <button
                    onClick={() => draftSaleSetPayment("udhaar")}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-sm transition ${
                      draftSale.paymentType === "udhaar"
                        ? "bg-amber-50 border-amber-500 text-amber-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    📒 Udhaar
                    <span className="block text-[10px] font-normal text-slate-500">
                      Add to khata — customer required
                    </span>
                  </button>
                </div>
                {draftSale.paymentType === "udhaar" && !draftSale.customerId && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg mt-2 font-semibold">
                    ⚠ Udhaar requires a customer. Pick one below.
                  </p>
                )}
              </div>

              {/* Customer — required for udhaar */}
              {draftSale.paymentType === "udhaar" && (
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase text-slate-500">
                      Customer (required for Udhaar)
                    </p>
                    <button
                      onClick={() => setShowNewCust(true)}
                      className="text-[11px] font-bold text-teal-700 hover:underline"
                    >
                      + Add New
                    </button>
                  </div>
                  <select
                    value={draftSale.customerId || ""}
                    onChange={(e) => draftSaleSetCustomer(e.target.value ? +e.target.value : null)}
                    className="mt-1 w-full p-2.5 border-2 border-slate-200 rounded-lg bg-white font-semibold text-sm"
                  >
                    <option value="">— Select customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => {
                  if (draftSale.paymentType === "udhaar" && !draftSale.customerId) {
                    setErr("Udhaar needs a customer");
                    return;
                  }
                  setErr("");
                  setShowBill(false);
                  setShowPay(true);
                }}
                disabled={
                  draftSale.paymentType === "udhaar" && !draftSale.customerId
                }
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl text-base transition active:scale-95"
              >
                💾 Save Bill
              </button>
              {err && (
                <p className="text-rose-600 text-sm text-center">{err}</p>
              )}
            </>
          )}
        </div>
      </Sheet>

      {/* Add new customer */}
      <Sheet
        open={showNewCust}
        onClose={() => setShowNewCust(false)}
        title="Add New Customer"
      >
        <div className="space-y-2">
          <Input
            value={newCustName}
            onChange={(e) => setNewCustName(e.target.value)}
            placeholder="Customer name"
            className="h-11"
          />
          <Input
            value={newCustPhone}
            onChange={(e) => setNewCustPhone(e.target.value)}
            placeholder="Phone (optional)"
            inputMode="tel"
            className="h-11"
          />
          <Button
            onClick={() => {
              if (!newCustName.trim()) return;
              const res = addCustomer(newCustName.trim(), newCustPhone || undefined);
              if (res.customer) draftSaleSetCustomer(res.customer.id);
              setNewCustName("");
              setNewCustPhone("");
              setShowNewCust(false);
            }}
            className="w-full bg-teal-600 hover:bg-teal-500 font-bold h-11"
          >
            Add Customer
          </Button>
        </div>
      </Sheet>

      {/* Payment confirm */}
      <Sheet open={showPay} onClose={() => setShowPay(false)} title="Confirm Payment">
        <div className="text-center mb-3">
          <p className="text-[11px] uppercase font-bold text-slate-500">Total to pay</p>
          <p className="text-3xl font-extrabold text-slate-900">{fmtRs(total)}</p>
          <p className="text-sm text-slate-500 mt-1">
            {draftSale.paymentType === "cash" ? "Cash sale" : "Udhaar — added to khata"}
          </p>
        </div>
        {draftSale.paymentType === "cash" && (
          <div className="space-y-2">
            <Input
              type="number"
              inputMode="numeric"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="Amount received (Rs.)"
              className="h-12 text-xl font-bold"
            />
            {paid && parseFloat(paid) >= total && (
              <p className="text-emerald-600 font-bold text-center text-lg">
                Change: {fmtRs(parseFloat(paid) - total)}
              </p>
            )}
            {paid && parseFloat(paid) < total && (
              <p className="text-rose-600 font-bold text-center">
                Short by {fmtRs(total - parseFloat(paid))}
              </p>
            )}
          </div>
        )}
        <button
          onClick={handleConfirmPay}
          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl text-base transition active:scale-95"
        >
          ✔ Confirm & Save
        </button>
      </Sheet>

      {/* Item picker sheet */}
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
              const unitPriceNum = customPrice ? parseFloat(customPrice) : item.pricePerBaseUnit;
              const totalLine = unit
                ? Math.round(qtyNum * unit.conversionToBase * (unitPriceNum || item.pricePerBaseUnit) * 100) / 100
                : 0;

              // Estimated weight calculations
              const amtNum = parseFloat(estAmount) || 0;
              const rateNum = parseFloat(estRatePerKg) || 0;
              const rawGrams = rateNum > 0 && amtNum > 0 ? (amtNum / rateNum) * 1000 : 0;
              const roundedGrams = Math.round(rawGrams / 10) * 10;

              // Below cost checks
              const isBelowCostQty = customPrice && parseFloat(customPrice) < (item.costPerBaseUnit || 0);
              const isKg = item.baseUnitName.toLowerCase() === "kg" || item.baseUnitName.toLowerCase() === "kilogram";
              const costPerKg = isKg ? (item.costPerBaseUnit || 0) : ((item.costPerBaseUnit || 0) * 1000);
              const isBelowCostEst = rateNum > 0 && costPerKg > 0 && rateNum < costPerKg;

              return (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-4xl">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        Default: {fmtRs(item.pricePerBaseUnit)} per {item.baseUnitName}
                        {item.costPerBaseUnit ? ` (Cost: ${fmtRs(item.costPerBaseUnit)})` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        In stock: {stockDisplay(item)}
                      </p>
                    </div>
                  </div>

                  {/* Mode switcher tabs */}
                  <div className="flex gap-2 mb-3 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSaleMode("qty")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        saleMode === "qty" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                      }`}
                    >
                      📦 By Quantity
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleMode("amount")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        saleMode === "amount" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"
                      }`}
                    >
                      ⚖️ By Amount (Est. Weight)
                    </button>
                  </div>

                  {saleMode === "qty" ? (
                    <>
                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Unit
                      </p>
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

                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Quantity
                      </p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="0"
                        autoFocus
                        className="h-12 text-xl font-bold"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                        {[1, 2, 5, 10, 20, 50].map((n) => (
                          <button
                            key={n}
                            onClick={() => setQty(String(n))}
                            className="flex-1 min-w-[50px] px-2 py-1 text-[12px] font-semibold rounded-full border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition"
                          >
                            {n}
                          </button>
                        ))}
                      </div>

                      {/* Negotiated / Agreed Price Override */}
                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Agreed Price per {item.baseUnitName} (Optional Override)
                      </p>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        placeholder={`Default: Rs. ${item.pricePerBaseUnit}`}
                        className="h-10 text-sm font-semibold mb-2"
                      />

                      {isBelowCostQty && (
                        <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg mb-2">
                          ⚠️ Warning: Price Rs. {customPrice} is below cost (Rs. {item.costPerBaseUnit}). Allowed, but action will be audited.
                        </p>
                      )}

                      <div className="mt-2 p-2.5 bg-teal-50 border border-teal-200 rounded-lg flex items-baseline justify-between">
                        <span className="text-sm text-slate-700">Line Total</span>
                        <span className="font-extrabold text-teal-800 text-lg">
                          {fmtRs(totalLine)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Amount-based estimated weight sale */}
                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Sale Amount (روپوں کا حساب) *
                      </p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={estAmount}
                        onChange={(e) => setEstAmount(e.target.value)}
                        placeholder="e.g. 100"
                        className="h-12 text-2xl font-bold"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                        {[50, 100, 200, 300, 500].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setEstAmount(String(amt))}
                            className="flex-1 min-w-[50px] px-2 py-1 text-[12px] font-semibold rounded-full border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition"
                          >
                            Rs. {amt}
                          </button>
                        ))}
                      </div>

                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Confirmed Rate per Kg (Rs./kg) *
                      </p>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={estRatePerKg}
                        onChange={(e) => setEstRatePerKg(e.target.value)}
                        placeholder="e.g. 450"
                        className="h-10 text-sm font-semibold mb-2"
                      />

                      {isBelowCostEst && (
                        <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg mb-2">
                          ⚠️ Warning: Rate Rs. {estRatePerKg}/kg is below cost. Allowed, but action will be audited.
                        </p>
                      )}

                      {amtNum > 0 && rateNum > 0 && (
                        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1 mb-2">
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>Exact Estimated Weight:</span>
                            <span className="font-semibold">{rawGrams.toFixed(2)} g</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold text-teal-900">
                            <span>Stock Deduction (Nearest 10g):</span>
                            <span>{roundedGrams} g</span>
                          </div>
                          <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-teal-200 pt-1 mt-1">
                            <span>Charged Amount:</span>
                            <span>{fmtRs(amtNum)}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 italic">
                            * Stock rounds to 10g. Customer bill is always exact Rs. {amtNum}.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {err && <p className="text-rose-600 text-sm mt-2">{err}</p>}

                  <button
                    onClick={handleAdd}
                    disabled={
                      saleMode === "qty"
                        ? !qty || !unitId || parseFloat(qty) <= 0
                        : !estAmount || !estRatePerKg || parseFloat(estAmount) <= 0 || parseFloat(estRatePerKg) <= 0
                    }
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

      {/* Done toast / receipt */}
      <Sheet open={!!doneBill} onClose={closeDone} title="✅ Bill Saved">
        {doneBill && <DoneBillView billId={doneBill.id} total={doneBill.total} onHistory={() => { setDoneBill(null); navigate("bill-history", { filterType: "sales" }); }} onNew={() => setDoneBill(null)} />}
      </Sheet>
    </div>
  );
}

// Per resolution #1 — live sync status display
function DoneBillView({
  billId,
  total,
  onHistory,
  onNew,
}: {
  billId: number;
  total: number;
  onHistory: () => void;
  onNew: () => void;
}) {
  const syncStatus = useApp((s) => s.saleBills.find((b) => b.id === billId)?.syncStatus || "pending");
  const isOnline = useApp((s) => s.isOnline);
  return (
    <div className="text-center py-2">
      <div className="text-5xl mb-2">✅</div>
      <p className="font-extrabold text-lg">Bill #{billId} saved</p>
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
      <div className="grid grid-cols-2 gap-2 mt-5">
        <Button variant="outline" onClick={onHistory} className="h-11">
          📜 View History
        </Button>
        <Button onClick={onNew} className="bg-teal-600 hover:bg-teal-500 h-11">
          + New Bill
        </Button>
      </div>
    </div>
  );
}
