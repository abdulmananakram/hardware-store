"use client";

import { useState } from "react";
import { useApp, fmtRs, stockDisplay, fmtDate } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdjustmentType } from "@/lib/types";
import { Sheet } from "@/components/parts/Sheet";

const ADJUSTMENT_TYPES: {
  value: AdjustmentType;
  label: string;
  icon: string;
  sign: "in" | "out";
  desc: string;
}[] = [
  { value: "restock", label: "Restock", icon: "📦", sign: "in", desc: "Add stock from a purchase or return" },
  { value: "correction", label: "Correction", icon: "🔧", sign: "in", desc: "Fix count discrepancy (audit adjustment)" },
  { value: "damage", label: "Damage", icon: "💔", sign: "out", desc: "Mark items as damaged / unsellable" },
  { value: "loss", label: "Loss", icon: "📉", sign: "out", desc: "Lost, stolen, or unaccounted for" },
];

export function StockAdjustmentScreen() {
  const params = useApp((s) => s.params);
  const items = useApp((s) => s.items);
  const stockAdjustments = useApp((s) => s.stockAdjustments);
  const adjustStock = useApp((s) => s.adjustStock);
  const navigate = useApp((s) => s.navigate);

  const item = params.itemId ? items.find((i) => i.id === params.itemId) : null;
  const [type, setType] = useState<AdjustmentType | null>(null);
  const [deltaStr, setDeltaStr] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [err, setErr] = useState("");

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

  const delta = parseFloat(deltaStr) || 0;
  const signedDelta =
    type && (type === "damage" || type === "loss") ? -Math.abs(delta) : Math.abs(delta);
  const newQty = Math.round((item.qtyInBaseUnit + signedDelta) * 100) / 100;

  const itemAdjustments = stockAdjustments
    .filter((a) => a.itemId === item.id)
    .sort((a, b) => new Date(b.adjustedAt).getTime() - new Date(a.adjustedAt).getTime());

  const handleConfirm = () => {
    if (!type || !deltaStr || delta <= 0) {
      setErr("Pick type and enter quantity");
      return;
    }
    if (!reason.trim()) {
      setErr("Reason required (audit trail)");
      return;
    }
    setErr("");
    setConfirm(true);
  };

  const handleSubmit = () => {
    const res = adjustStock(item.id, type!, signedDelta, reason.trim());
    if (!res.ok) {
      setErr(res.error || "Failed");
      setConfirm(false);
      return;
    }
    setConfirm(false);
    setResult({ ok: true });
  };

  return (
    <div className="px-3 pt-3 pb-32">
      {/* Item summary */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center text-2xl">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{item.name}</p>
            <p className="text-[11px] text-slate-500">{fmtRs(item.pricePerBaseUnit)} / {item.baseUnitName}</p>
            <p className="text-[11px] font-semibold text-slate-700">
              Current: {stockDisplay(item)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-center">
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase font-bold">Opening Stock</p>
            <p className="font-bold text-sm">
              {item.initialQtyInBaseUnit} {item.baseUnitName}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase font-bold">Low-stock at</p>
            <p className="font-bold text-sm">
              {item.lowStockThreshold} {item.baseUnitName}
            </p>
          </div>
        </div>
      </div>

      <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">
        New Adjustment
      </h3>

      {/* Type picker */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {ADJUSTMENT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setType(t.value);
              setErr("");
            }}
            className={`py-3 px-2 rounded-xl border-2 text-left transition ${
              type === t.value
                ? t.sign === "in"
                  ? "bg-emerald-50 border-emerald-500"
                  : "bg-rose-50 border-rose-500"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{t.icon}</span>
              <span className="font-bold text-sm">{t.label}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{t.desc}</p>
          </button>
        ))}
      </div>

      {type && (
        <>
          <div>
            <Label className="text-[11px] font-bold uppercase text-slate-500">
              Quantity (in {item.baseUnitName})
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              value={deltaStr}
              onChange={(e) => setDeltaStr(e.target.value)}
              placeholder="0"
              className="h-14 text-2xl font-bold"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[1, 5, 10, 25, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => setDeltaStr(String(n))}
                  className="flex-1 min-w-[50px] px-2 py-1.5 text-[13px] font-semibold rounded-full border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <Label className="text-[11px] font-bold uppercase text-slate-500">
              Reason (required)
            </Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                type === "damage"
                  ? "e.g. 5 items damaged during transport"
                  : type === "loss"
                  ? "e.g. Found 3 missing during stock count"
                  : "e.g. Restock from local market purchase"
              }
              className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm h-20 mt-1 focus:border-teal-500 outline-none"
            />
          </div>

          {/* Live preview */}
          {delta > 0 && (
            <div
              className={`mt-3 p-3 rounded-lg border-2 ${
                signedDelta > 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-rose-50 border-rose-200"
              }`}
            >
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-slate-700">
                  {signedDelta > 0 ? "Adding" : "Removing"}:
                </span>
                <span
                  className={`font-extrabold text-lg ${
                    signedDelta > 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {signedDelta > 0 ? "+" : ""}
                  {signedDelta} {item.baseUnitName}
                </span>
              </div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-xs text-slate-500">New stock will be:</span>
                <span className="font-bold text-sm">
                  {newQty} {item.baseUnitName}
                </span>
              </div>
              {newQty < 0 && (
                <p className="text-rose-600 text-xs mt-1">⚠ Cannot go below zero</p>
              )}
              {newQty <= item.lowStockThreshold && newQty >= 0 && (
                <p className="text-amber-600 text-xs mt-1">
                  ⚠ Will trigger low-stock alert (≤ {item.lowStockThreshold} {item.baseUnitName})
                </p>
              )}
            </div>
          )}

          {err && (
            <p className="text-rose-600 text-sm text-center bg-rose-50 p-2 rounded-lg mt-3">{err}</p>
          )}

          <Button
            onClick={handleConfirm}
            disabled={!type || delta <= 0 || !reason.trim() || newQty < 0}
            className="w-full mt-3 bg-amber-600 hover:bg-amber-500 font-extrabold h-12"
          >
            ⚖️ Process Adjustment
          </Button>
        </>
      )}

      {/* History */}
      <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2 mt-5">
        Adjustment History ({itemAdjustments.length})
      </h3>
      <div className="bg-white rounded-xl overflow-hidden border border-slate-100">
        {itemAdjustments.length === 0 && (
          <p className="p-4 text-center text-slate-500 text-sm">No adjustments yet</p>
        )}
        {itemAdjustments.map((a) => {
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
                  {a.reason && (
                    <span className="text-[11px] text-slate-500"> — {a.reason}</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">
                  {fmtDate(a.adjustedAt)} • New qty: {a.newQtyInBaseUnit} {item.baseUnitName}
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

      {/* Confirm sheet */}
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Confirm Adjustment">
        <div className="space-y-2">
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <p>
              <b>Item:</b> {item.name}
            </p>
            <p>
              <b>Type:</b>{" "}
              {ADJUSTMENT_TYPES.find((t) => t.value === type)?.label}
            </p>
            <p>
              <b>Change:</b>{" "}
              <span className={signedDelta > 0 ? "text-emerald-700" : "text-rose-700"}>
                {signedDelta > 0 ? "+" : ""}
                {signedDelta} {item.baseUnitName}
              </span>
            </p>
            <p>
              <b>Reason:</b> {reason}
            </p>
            <p className="pt-1 border-t border-slate-200">
              <b>New stock:</b> {newQty} {item.baseUnitName}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-amber-600 hover:bg-amber-500 font-bold"
            >
              Confirm
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Success sheet */}
      <Sheet
        open={!!result}
        onClose={() => {
          setResult(null);
          navigate("item-detail", { itemId: item.id });
        }}
        title="✅ Adjustment Recorded"
      >
        <div className="text-center py-2">
          <div className="text-5xl mb-2">✅</div>
          <p className="font-extrabold text-lg">
            {signedDelta > 0 ? "Added" : "Removed"} {Math.abs(signedDelta)} {item.baseUnitName}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            New stock: <b>{newQty} {item.baseUnitName}</b>
          </p>
          <Button
            onClick={() => {
              setResult(null);
              navigate("item-detail", { itemId: item.id });
            }}
            className="w-full mt-4 bg-teal-600 hover:bg-teal-500 font-bold h-11"
          >
            ← Back to Item
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
