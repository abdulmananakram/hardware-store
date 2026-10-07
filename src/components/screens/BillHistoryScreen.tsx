"use client";

import { useState } from "react";
import { useApp, fmtRs, fmtDate } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/parts/Sheet";

export function BillHistoryScreen() {
  const params = useApp((s) => s.params);
  const saleBills = useApp((s) => s.saleBills);
  const purchaseBills = useApp((s) => s.purchaseBills);
  const suppliers = useApp((s) => s.suppliers);
  const getCustomer = useApp((s) => s.getCustomer);
  const items = useApp((s) => s.items);
  const cancelSaleBill = useApp((s) => s.cancelSaleBill);
  const cancelPurchaseBill = useApp((s) => s.cancelPurchaseBill);
  const navigate = useApp((s) => s.navigate);

  const [tab, setTab] = useState<"sales" | "purchases">(
    params.filterType === "purchases" ? "purchases" : "sales"
  );
  const [openBill, setOpenBill] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [err, setErr] = useState("");

  const list =
    tab === "sales"
      ? saleBills.map((b) => ({
          id: b.id,
          date: b.billDate,
          party: b.customerId ? getCustomer(b.customerId)?.name || "Customer" : "Walk-in",
          total: b.totalAmount,
          paymentType: b.paymentType,
          sync: b.syncStatus,
          cancelled: b.cancelled,
          lines: b.lines,
          kind: "sale" as const,
        }))
      : purchaseBills.map((b) => ({
          id: b.id,
          date: b.billDate,
          party: suppliers.find((sp) => sp.id === b.supplierId)?.name || "Supplier",
          total: b.totalAmount,
          paymentType: b.paymentType,
          sync: b.syncStatus,
          cancelled: b.cancelled,
          lines: b.lines,
          kind: "purchase" as const,
        }));

  const bill = openBill ? list.find((b) => b.id === openBill) : null;

  return (
    <div className="px-3 pt-3 pb-28">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-3">
        <button
          onClick={() => setTab("sales")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
            tab === "sales" ? "bg-white shadow text-slate-900" : "text-slate-500"
          }`}
        >
          🧾 Sales
        </button>
        <button
          onClick={() => setTab("purchases")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
            tab === "purchases" ? "bg-white shadow text-slate-900" : "text-slate-500"
          }`}
        >
          🚚 Purchases
        </button>
      </div>

      <div className="space-y-1.5">
        {list.map((b) => (
          <button
            key={`${b.kind}-${b.id}`}
            onClick={() => setOpenBill(b.id)}
            className={`w-full bg-white rounded-xl p-3 shadow-sm border flex items-center gap-3 text-left transition active:scale-[0.98] ${
              b.cancelled ? "border-rose-200 opacity-60" : "border-slate-100"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                b.paymentType === "cash" ? "bg-emerald-100" : "bg-amber-100"
              }`}
            >
              {b.paymentType === "cash" ? "💵" : "📒"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">
                {b.party}
                {b.cancelled && (
                  <span className="ml-2 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                    CANCELLED
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                #{b.id} • {fmtDate(b.date)} • {b.lines.length} items
              </p>
            </div>
            <div className="text-right">
              <p className="font-extrabold text-sm">{fmtRs(b.total)}</p>
              {b.sync === "pending" ? (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  ☁ PENDING
                </span>
              ) : (
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  ✓ SYNCED
                </span>
              )}
            </div>
          </button>
        ))}
        {list.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">📜</p>
            <p className="text-slate-500 text-sm">No {tab} bills yet</p>
          </div>
        )}
      </div>

      {/* Bill detail sheet */}
      <Sheet
        open={!!bill}
        onClose={() => setOpenBill(null)}
        title={bill ? `${bill.kind === "sale" ? "Sale" : "Purchase"} Bill #${bill.id}` : ""}
      >
        {bill && (
          <div>
            <div className="flex justify-between items-center mb-2 text-sm">
              <div>
                <p className="text-slate-500 text-[11px]">Date</p>
                <p className="font-semibold">{new Date(bill.date).toLocaleString("en-PK")}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-[11px]">{bill.party}</p>
                <p className="font-semibold capitalize">
                  {bill.paymentType === "cash" ? "💵 Cash" : "📒 Udhaar"}
                </p>
              </div>
            </div>

            <div className="border-t pt-2">
              {bill.lines.map((l) => {
                const item = items.find((i) => i.id === l.itemId);
                const unit = item?.units.find((u) => u.id === l.unitId);
                const qty =
                  bill.kind === "sale"
                    ? (l as any).qtyInSoldUnit
                    : (l as any).qtyInPurchasedUnit;
                return (
                  <div key={l.id} className="flex justify-between py-1.5 border-b border-slate-100 text-sm">
                    <div>
                      <p className="font-semibold">{item?.name || "?"}</p>
                      <p className="text-[11px] text-slate-500">
                        {qty} {unit?.unitName} ×{" "}
                        {fmtRs(
                          bill.kind === "sale"
                            ? (l as any).unitPriceAtSale
                            : (l as any).unitCost
                        )}
                      </p>
                    </div>
                    <p className="font-bold">{fmtRs((l as any).lineTotal)}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center py-3 border-t-2 border-slate-900 mt-2">
              <span className="font-bold text-lg">TOTAL</span>
              <span className="font-extrabold text-xl">{fmtRs(bill.total)}</span>
            </div>

            {bill.sync === "pending" && (
              <p className="text-amber-600 text-xs bg-amber-50 p-2 rounded-lg">
                ☁ Pending sync — will upload when online
              </p>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {bill.kind === "sale" && !bill.cancelled && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate("return", {
                        saleBillId: bill.id,
                      })
                    }
                    className="border-amber-300 text-amber-700 font-bold h-11"
                  >
                    ↩️ Return Item
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCancelReason("");
                      setShowCancel(true);
                    }}
                    className="border-rose-300 text-rose-700 font-bold h-11"
                  >
                    🚫 Cancel Bill
                  </Button>
                </>
              )}
              {bill.kind === "purchase" && !bill.cancelled && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCancelReason("");
                    setShowCancel(true);
                  }}
                  className="border-rose-300 text-rose-700 font-bold h-11 col-span-2"
                >
                  🚫 Cancel Purchase
                </Button>
              )}
              <Button
                onClick={() => setOpenBill(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold h-11 col-span-2"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Cancel reason sheet — handles both sale & purchase bills */}
      <Sheet open={showCancel} onClose={() => setShowCancel(false)} title="Cancel Bill?">
        <p className="text-sm text-slate-600 mb-3">
          {bill?.kind === "purchase" ? (
            <>
              Cancelling a purchase will <b>reverse the stock addition</b>. If any of the
              purchased items have already been sold further, the cancel will be{" "}
              <b>blocked</b> to prevent negative stock.
            </>
          ) : (
            <>
              Cancelling will reverse stock changes and any khata entry. The bill stays in
              history as <b>Cancelled</b>.
            </>
          )}
        </p>
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Reason (e.g. wrong entry, customer returned all)"
          className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm h-24"
        />
        {err && <p className="text-rose-600 text-sm mt-2 bg-rose-50 p-2 rounded-lg">{err}</p>}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="outline" onClick={() => setShowCancel(false)}>
            Keep Bill
          </Button>
          <Button
            onClick={() => {
              if (!bill) return;
              const res =
                bill.kind === "sale"
                  ? cancelSaleBill(bill.id, cancelReason || "No reason")
                  : cancelPurchaseBill(bill.id, cancelReason || "No reason");
              if (!res.ok) {
                setErr(res.error || "Cannot cancel");
                return;
              }
              setErr("");
              setShowCancel(false);
              setOpenBill(null);
            }}
            className="bg-rose-600 hover:bg-rose-500 font-bold"
          >
            Cancel Bill
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
