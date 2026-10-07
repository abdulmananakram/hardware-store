"use client";

import { useState } from "react";
import { useApp, fmtRs, fmtDate } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/parts/Sheet";

export function SuppliersScreen() {
  const suppliers = useApp((s) => s.suppliers);
  const recordSupplierPayment = useApp((s) => s.recordSupplierPayment);
  const addSupplier = useApp((s) => s.addSupplier);
  const navigate = useApp((s) => s.navigate);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [paySupId, setPaySupId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const sorted = [...suppliers].sort((a, b) => b.payableBalance - a.payableBalance);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addSupplier(newName.trim(), newPhone || undefined);
    setNewName("");
    setNewPhone("");
    setShowAdd(false);
  };

  const sup = paySupId ? suppliers.find((c) => c.id === paySupId) : null;

  return (
    <div className="px-3 pt-3 pb-28">
      <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-2xl p-4 shadow-lg mb-3">
        <p className="text-[11px] uppercase font-bold tracking-wide opacity-90">
          Total Payable
        </p>
        <p className="text-3xl font-extrabold">
          {fmtRs(suppliers.reduce((s, sp) => sp.payableBalance + s, 0))}
        </p>
        <p className="text-xs opacity-90 mt-0.5">{suppliers.length} suppliers</p>
      </div>

      <Button
        onClick={() => setShowAdd(true)}
        className="w-full bg-teal-600 hover:bg-teal-500 font-bold h-11 mb-3"
      >
        ➕ Add Supplier
      </Button>

      <div className="space-y-1.5">
        {sorted.map((sp) => (
          <div key={sp.id} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <button
              onClick={() => navigate("supplier-detail", { supplierId: sp.id })}
              className="w-full flex items-center gap-3 text-left"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                sp.payableBalance > 0 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"
              }`}>
                {sp.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{sp.name}</p>
                <p className="text-[11px] text-slate-500">{sp.phone || "No phone"}</p>
              </div>
              <div className="text-right">
                {sp.payableBalance > 0 ? (
                  <>
                    <p className="font-extrabold text-orange-600 text-sm">
                      {fmtRs(sp.payableBalance)}
                    </p>
                    <p className="text-[10px] text-slate-500">you owe</p>
                  </>
                ) : (
                  <p className="text-[11px] text-emerald-600 font-bold">✓ Settled</p>
                )}
              </div>
            </button>
            {sp.payableBalance > 0 && (
              <button
                onClick={() => {
                  setPaySupId(sp.id);
                  setPayAmount("");
                }}
                className="w-full mt-2 py-2 bg-orange-50 text-orange-700 font-bold text-sm rounded-lg hover:bg-orange-100 transition active:scale-95"
              >
                💵 Record Payment Made
              </button>
            )}
          </div>
        ))}
      </div>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add Supplier">
        <div className="space-y-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Supplier name"
            className="h-11"
          />
          <Input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Phone (optional)"
            inputMode="tel"
            className="h-11"
          />
          <Button
            onClick={handleAdd}
            className="w-full bg-teal-600 hover:bg-teal-500 font-bold h-11"
          >
            Add Supplier
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!sup} onClose={() => setPaySupId(null)} title="Record Payment">
        {sup && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-slate-500">{sup.name}</p>
              <p className="text-[11px] text-slate-500">Outstanding</p>
              <p className="text-3xl font-extrabold text-orange-600">
                {fmtRs(sup.payableBalance)}
              </p>
            </div>
            <Input
              type="number"
              inputMode="numeric"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount paid (Rs.)"
              className="h-12 text-xl font-bold"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPayAmount(String(sup.payableBalance))}
                className="flex-1 py-2 rounded-lg border-2 border-slate-200 text-sm font-bold hover:bg-teal-50 hover:border-teal-300"
              >
                Full ({fmtRs(sup.payableBalance)})
              </button>
              <button
                onClick={() => setPayAmount(String(Math.floor(sup.payableBalance / 2)))}
                className="flex-1 py-2 rounded-lg border-2 border-slate-200 text-sm font-bold hover:bg-teal-50 hover:border-teal-300"
              >
                Half
              </button>
            </div>
            <Button
              onClick={() => {
                if (!payAmount) return;
                recordSupplierPayment(sup.id, parseFloat(payAmount), undefined);
                setPaySupId(null);
                setPayAmount("");
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-extrabold h-12"
            >
              💾 Save Payment
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export function SupplierDetailScreen() {
  const params = useApp((s) => s.params);
  const suppliers = useApp((s) => s.suppliers);
  const khataTransactions = useApp((s) => s.khataTransactions);

  const sup = suppliers.find((c) => c.id === params.supplierId);
  if (!sup) {
    return <div className="p-6 text-center text-slate-500">Supplier not found.</div>;
  }

  const txns = khataTransactions
    .filter((t) => t.partyType === "supplier" && t.partyId === sup.id)
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  const withRunning = txns
    .reduce<{ running: number; items: typeof txns }>(
      (acc, t) => {
        const delta = t.transactionType === "payable_incurred" ? t.amount : -t.amount;
        const running = Math.round((acc.running + delta) * 100) / 100;
        return { running, items: [...acc.items, { ...t, running }] };
      },
      { running: 0, items: [] }
    )
    .items.reverse();

  return (
    <div className="px-3 pt-3 pb-28">
      <div className={`rounded-2xl p-4 shadow-lg mb-3 text-white ${
        sup.payableBalance > 0
          ? "bg-gradient-to-br from-orange-500 to-orange-700"
          : "bg-gradient-to-br from-emerald-500 to-emerald-700"
      }`}>
        <p className="text-[11px] uppercase font-bold opacity-90">{sup.name}</p>
        <p className="text-[11px] opacity-80">{sup.phone || "No phone"}</p>
        <p className="text-3xl font-extrabold mt-1">{fmtRs(sup.payableBalance)}</p>
        <p className="text-xs opacity-90">
          {sup.payableBalance > 0 ? "You owe" : "All settled"}
        </p>
      </div>

      <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">
        Transaction History
      </h3>
      <div className="bg-white rounded-xl overflow-hidden border border-slate-100">
        {withRunning.length === 0 && (
          <p className="p-4 text-center text-slate-500 text-sm">No transactions</p>
        )}
        {withRunning.map((t) => {
          const incurred = t.transactionType === "payable_incurred";
          return (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                incurred ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {incurred ? "↗" : "↙"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {incurred ? "Purchase on Udhaar" : "Payment Made"}
                  {t.note && <span className="text-[11px] text-slate-500"> — {t.note}</span>}
                </p>
                <p className="text-[11px] text-slate-500">{fmtDate(t.transactionDate)}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${incurred ? "text-orange-600" : "text-emerald-600"}`}>
                  {incurred ? "+" : "−"}{fmtRs(t.amount)}
                </p>
                <p className="text-[10px] text-slate-500">Bal: {fmtRs(t.running)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
