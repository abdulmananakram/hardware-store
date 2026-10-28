"use client";

import { useState } from "react";
import { useApp, fmtRs, fmtDate } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/parts/Sheet";

export function CustomersScreen() {
  const customers = useApp((s) => s.customers);
  const khataTransactions = useApp((s) => s.khataTransactions);
  const recordCustomerPayment = useApp((s) => s.recordCustomerPayment);
  const addCustomer = useApp((s) => s.addCustomer);
  const navigate = useApp((s) => s.navigate);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [warn, setWarn] = useState("");
  const [payCustId, setPayCustId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");

  // Sort by balance desc
  const sorted = [...customers].sort((a, b) => b.khataBalance - a.khataBalance);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const res = addCustomer(newName.trim(), newPhone || undefined);
    if (res.warning) {
      setWarn(res.warning);
      setTimeout(() => setWarn(""), 3000);
    }
    setNewName("");
    setNewPhone("");
    setShowAdd(false);
  };

  const cust = payCustId ? customers.find((c) => c.id === payCustId) : null;

  return (
    <div className="px-3 pt-3 pb-28">
      {/* Summary */}
      <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white rounded-2xl p-4 shadow-lg mb-3">
        <p className="text-[11px] uppercase font-bold tracking-wide opacity-90">
          Total Receivable
        </p>
        <p className="text-3xl font-extrabold">
          {fmtRs(customers.filter((c) => c.khataBalance > 0).reduce((s, c) => s + c.khataBalance, 0))}
        </p>
        <p className="text-xs opacity-90 mt-0.5">{customers.length} customers</p>
      </div>

      <Button
        onClick={() => setShowAdd(true)}
        className="w-full bg-teal-600 hover:bg-teal-500 font-bold h-11 mb-3"
      >
        ➕ Add Customer
      </Button>

      <div className="space-y-1.5">
        {sorted.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl p-3 shadow-sm border border-slate-100"
          >
            <button
              onClick={() => navigate("customer-detail", { customerId: c.id })}
              className="w-full flex items-center gap-3 text-left"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                c.khataBalance > 0 ? "bg-rose-100 text-rose-700" : c.khataBalance < 0 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-600"
              }`}>
                {c.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{c.name}</p>
                <p className="text-[11px] text-slate-500">{c.phone || "No phone"}</p>
              </div>
              <div className="text-right">
                {c.khataBalance > 0 ? (
                  <>
                    <p className="font-extrabold text-rose-600 text-sm">
                      {fmtRs(c.khataBalance)}
                    </p>
                    <p className="text-[10px] text-slate-500">owes you</p>
                  </>
                ) : c.khataBalance < 0 ? (
                  <>
                    <p className="font-extrabold text-teal-600 text-sm">
                      {fmtRs(Math.abs(c.khataBalance))}
                    </p>
                    <p className="text-[10px] text-teal-700 font-semibold">advance / credit</p>
                  </>
                ) : (
                  <p className="text-[11px] text-emerald-600 font-bold">✓ Settled</p>
                )}
              </div>
            </button>
            {c.khataBalance > 0 && (
              <button
                onClick={() => {
                  setPayCustId(c.id);
                  setPayAmount("");
                }}
                className="w-full mt-2 py-2 bg-emerald-50 text-emerald-700 font-bold text-sm rounded-lg hover:bg-emerald-100 transition active:scale-95"
              >
                💵 Record Payment Received
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add customer */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add Customer">
        <div className="space-y-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Customer name"
            className="h-11"
          />
          <Input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Phone (optional)"
            inputMode="tel"
            className="h-11"
          />
          {warn && (
            <p className="text-amber-700 text-xs bg-amber-50 p-2 rounded-lg">{warn}</p>
          )}
          <Button
            onClick={handleAdd}
            className="w-full bg-teal-600 hover:bg-teal-500 font-bold h-11"
          >
            Add Customer
          </Button>
        </div>
      </Sheet>

      {/* Payment sheet */}
      <Sheet open={!!cust} onClose={() => setPayCustId(null)} title="Record Payment">
        {cust && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-slate-500">{cust.name}</p>
              <p className="text-[11px] text-slate-500">Outstanding</p>
              <p className="text-3xl font-extrabold text-rose-600">
                {fmtRs(cust.khataBalance)}
              </p>
            </div>
            <Input
              type="number"
              inputMode="numeric"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount received (Rs.)"
              className="h-12 text-xl font-bold"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPayAmount(String(cust.khataBalance))}
                className="flex-1 py-2 rounded-lg border-2 border-slate-200 text-sm font-bold hover:bg-teal-50 hover:border-teal-300"
              >
                Full ({fmtRs(cust.khataBalance)})
              </button>
              <button
                onClick={() => setPayAmount(String(Math.floor(cust.khataBalance / 2)))}
                className="flex-1 py-2 rounded-lg border-2 border-slate-200 text-sm font-bold hover:bg-teal-50 hover:border-teal-300"
              >
                Half
              </button>
            </div>
            <Button
              onClick={() => {
                if (!payAmount) return;
                recordCustomerPayment(cust.id, parseFloat(payAmount), undefined);
                setPayCustId(null);
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

// ============================================================
// Customer detail ledger
// ============================================================

export function CustomerDetailScreen() {
  const params = useApp((s) => s.params);
  const customers = useApp((s) => s.customers);
  const khataTransactions = useApp((s) => s.khataTransactions);
  const navigate = useApp((s) => s.navigate);

  const cust = customers.find((c) => c.id === params.customerId);
  if (!cust) {
    return (
      <div className="p-6 text-center text-slate-500">
        Customer not found.
      </div>
    );
  }

  const txns = khataTransactions
    .filter((t) => t.partyType === "customer" && t.partyId === cust.id)
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  // Compute running balance via reduce (no mutation)
  const withRunning = txns
    .reduce<{ running: number; items: typeof txns }>(
      (acc, t) => {
        const delta = t.transactionType === "credit_given" ? t.amount : -t.amount;
        const running = Math.round((acc.running + delta) * 100) / 100;
        return { running, items: [...acc.items, { ...t, running }] };
      },
      { running: 0, items: [] }
    )
    .items.reverse();

  return (
    <div className="px-3 pt-3 pb-28">
      <div className={`rounded-2xl p-4 shadow-lg mb-3 text-white ${
        cust.khataBalance > 0
          ? "bg-gradient-to-br from-rose-500 to-rose-700"
          : "bg-gradient-to-br from-emerald-500 to-emerald-700"
      }`}>
        <p className="text-[11px] uppercase font-bold opacity-90">{cust.name}</p>
        <p className="text-[11px] opacity-80">{cust.phone || "No phone"}</p>
        <p className="text-3xl font-extrabold mt-1">{fmtRs(cust.khataBalance)}</p>
        <p className="text-xs opacity-90">
          {cust.khataBalance > 0 ? "Outstanding" : "All settled"}
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
          const credit = t.transactionType === "credit_given";
          return (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                credit ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {credit ? "↗" : "↙"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {credit ? "Bill on Udhaar" : "Payment Received"}
                  {t.note && <span className="text-[11px] text-slate-500"> — {t.note}</span>}
                </p>
                <p className="text-[11px] text-slate-500">{fmtDate(t.transactionDate)}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${credit ? "text-rose-600" : "text-emerald-600"}`}>
                  {credit ? "+" : "−"}{fmtRs(t.amount)}
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
