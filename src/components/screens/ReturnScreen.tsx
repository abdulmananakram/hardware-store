"use client";

import { useState, useMemo } from "react";
import { useApp, fmtRs } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReturnReason, ReturnDisposition } from "@/lib/types";
import { Sheet } from "@/components/parts/Sheet";

const REASONS: { value: ReturnReason; label: string }[] = [
  { value: "no_longer_needed", label: "No longer needed" },
  { value: "damaged", label: "Damaged" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "other", label: "Other" },
];

export function ReturnScreen() {
  const params = useApp((s) => s.params);
  const saleBills = useApp((s) => s.saleBills);
  const returns = useApp((s) => s.returns);
  const items = useApp((s) => s.items);
  const recordReturn = useApp((s) => s.recordReturn);
  const navigate = useApp((s) => s.navigate);

  const bill = saleBills.find((b) => b.id === params.saleBillId);
  const [selLine, setSelLine] = useState<number | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [disposition, setDisposition] = useState<ReturnDisposition | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");

  // Compute returnable qty per line
  const linesWithReturnable = useMemo(() => {
    if (!bill) return [];
    return bill.lines.map((l) => {
      const already = returns
        .filter((r) => r.saleBillLineId === l.id)
        .reduce((sum, r) => sum + r.qtyReturnedInBaseUnit, 0);
      return { line: l, returnable: l.qtyInBaseUnit - already };
    });
  }, [bill, returns]);

  if (!bill) {
    return (
      <div className="p-6 text-center text-slate-500">
        Bill not found.{" "}
        <button onClick={() => navigate("bill-history")} className="text-teal-700 font-bold">
          Back to history
        </button>
      </div>
    );
  }

  const sel = selLine ? linesWithReturnable.find((x) => x.line.id === selLine) : null;
  const item = sel ? items.find((i) => i.id === sel.line.itemId) : null;
  const qtyNum = parseFloat(qty) || 0;
  const refund = sel ? Math.round(qtyNum * sel.line.unitPriceAtSale * 100) / 100 : 0;

  const handleSubmit = () => {
    if (!sel || !reason || !disposition) {
      setErr("Pick line, qty, reason, and disposition");
      return;
    }
    if (qtyNum <= 0) {
      setErr("Enter quantity");
      return;
    }
    if (qtyNum > sel.returnable) {
      setErr(`Max returnable: ${sel.returnable}`);
      return;
    }
    setErr("");
    setConfirm(true);
  };

  const confirmReturn = () => {
    if (!sel || !reason || !disposition) return;
    const res = recordReturn(sel.line.id, qtyNum, reason, disposition);
    if (!res.ok) {
      setErr(res.error || "Failed");
      setConfirm(false);
      return;
    }
    setConfirm(false);
    navigate("bill-history", { filterType: "sales" });
  };

  return (
    <div className="px-3 pt-3 pb-32">
      <div className="bg-slate-50 rounded-xl p-3 mb-3">
        <p className="text-[11px] text-slate-500">Bill #{bill.id}</p>
        <p className="font-bold">Total: {fmtRs(bill.totalAmount)}</p>
        <p className="text-[11px] text-slate-500 mt-1">
          {bill.paymentType === "cash" ? "💵 Cash sale" : "📒 Udhaar sale"}
        </p>
      </div>

      <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">
        Pick the line being returned
      </h3>
      <div className="space-y-1.5 mb-4">
        {linesWithReturnable.map(({ line, returnable }) => {
          const item = items.find((i) => i.id === line.itemId);
          const unit = item?.units.find((u) => u.id === line.unitId);
          return (
            <button
              key={line.id}
              onClick={() => {
                setSelLine(line.id);
                setQty("");
                setErr("");
              }}
              disabled={returnable <= 0}
              className={`w-full bg-white rounded-xl p-3 shadow-sm border flex items-center gap-3 text-left transition disabled:opacity-40 ${
                selLine === line.id ? "border-teal-500 bg-teal-50/30" : "border-slate-100"
              }`}
            >
              <span className="text-2xl">{item?.icon || "📦"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{item?.name}</p>
                <p className="text-[11px] text-slate-500">
                  Sold: {line.qtyInSoldUnit} {unit?.unitName} = {line.qtyInBaseUnit} {item?.baseUnitName}
                </p>
                <p className="text-[11px] font-semibold text-amber-600">
                  Returnable: {returnable} {item?.baseUnitName}
                </p>
              </div>
              <span className="font-bold text-sm">{fmtRs(line.lineTotal)}</span>
            </button>
          );
        })}
      </div>

      {sel && item && (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
              Quantity to return (in {item.baseUnitName})
            </p>
            <Input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="h-14 text-2xl font-bold"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                onClick={() => setQty(String(sel.returnable))}
                className="px-3 py-1.5 text-[13px] font-semibold rounded-full border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300"
              >
                All ({sel.returnable})
              </button>
              {[0.25, 0.5, 1].map((n) => (
                <button
                  key={n}
                  onClick={() => setQty(String(Math.min(sel.returnable, Math.floor(sel.returnable * n) || n)))}
                  className="px-3 py-1.5 text-[13px] font-semibold rounded-full border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300"
                >
                  {n === 0.25 ? "¼" : n === 0.5 ? "½" : "1"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">Reason</p>
            <div className="grid grid-cols-2 gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`py-2.5 rounded-lg border-2 text-sm font-bold transition ${
                    reason === r.value
                      ? "bg-teal-50 border-teal-500 text-teal-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">Disposition</p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={() => setDisposition("back_to_sellable_stock")}
                className={`py-3 rounded-lg border-2 text-left transition ${
                  disposition === "back_to_sellable_stock"
                    ? "bg-emerald-50 border-emerald-500"
                    : "border-slate-200"
                }`}
              >
                <span className="font-bold text-sm">📦 Back in sellable stock</span>
                <p className="text-[11px] text-slate-500">
                  Item is fine — add it back to inventory
                </p>
              </button>
              <button
                onClick={() => setDisposition("damaged_pile")}
                className={`py-3 rounded-lg border-2 text-left transition ${
                  disposition === "damaged_pile"
                    ? "bg-rose-50 border-rose-500"
                    : "border-slate-200"
                }`}
              >
                <span className="font-bold text-sm">⚠️ Damaged — do not resell</span>
                <p className="text-[11px] text-slate-500">
                  Log for record only; stock not increased
                </p>
              </button>
            </div>
          </div>

          {qtyNum > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-baseline justify-between">
              <span className="text-sm text-slate-700">
                {bill.paymentType === "udhaar"
                  ? "Refund to customer khata"
                  : "Refund amount (cash handling is manual)"}
              </span>
              <span className="font-extrabold text-teal-800 text-lg">{fmtRs(refund)}</span>
            </div>
          )}

          {err && (
            <p className="text-rose-600 text-sm text-center bg-rose-50 p-2 rounded-lg">{err}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!reason || !disposition || qtyNum <= 0}
            className="w-full bg-amber-600 hover:bg-amber-500 font-extrabold h-12"
          >
            ↩️ Process Return
          </Button>
        </div>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Confirm Return">
        <p className="text-sm text-slate-600">Process this return?</p>
        <div className="bg-slate-50 rounded-lg p-3 mt-2 space-y-1 text-sm">
          <p>Item: <b>{item?.name}</b></p>
          <p>Qty: <b>{qtyNum} {item?.baseUnitName}</b></p>
          <p>Refund: <b>{fmtRs(refund)}</b></p>
          {bill.paymentType === "udhaar" ? (
            <p className="text-amber-600 text-xs mt-1">
              Refund will be credited to the customer's khata balance.
            </p>
          ) : (
            <p className="text-slate-500 text-xs mt-1">
              Cash refund is handled manually outside the app.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button onClick={confirmReturn} className="bg-amber-600 hover:bg-amber-500 font-bold">
            Confirm
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
