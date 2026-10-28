"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtRs } from "@/lib/store";
import { getLocalReport, type LocalReportKind } from "@/lib/localReports";

type Report = { kind: string; [key: string]: unknown };

export function ReportsScreen() {
  const [kind, setKind] = useState("sales");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let active = true;
    void getLocalReport(kind as LocalReportKind, from, to)
      .then((data) => { if (active) setReport(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Report unavailable"); });
    return () => { active = false; };
  }, [kind, from, to]);

  const print = () => window.print();
  const share = async () => {
    if (navigator.share) await navigator.share({ title: `Hardware Shop ${kind} report`, text: JSON.stringify(report) });
    else print();
  };

  return (
    <section className="p-3 space-y-3">
      <div className="flex gap-2 overflow-x-auto">
        {["sales", "stock", "udhaar", "profit"].map((value) => (
          <button key={value} onClick={() => setKind(value)} className={`px-3 py-2 rounded-lg text-sm font-bold ${kind === value ? "bg-teal-700 text-white" : "bg-white border"}`}>
            {value === "udhaar" ? "Udhaar" : value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-bold text-slate-500">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-500">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" /></label>
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={share} variant="outline">Share / PDF</Button>
        <Button onClick={print}>Print</Button>
      </div>
      {error && <p className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
      {report && (
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-lg font-extrabold">{kind[0].toUpperCase() + kind.slice(1)} report</h2>
          {typeof report.total === "number" && <p className="text-2xl font-extrabold text-teal-700">{fmtRs(report.total)}</p>}
          {typeof report.revenue === "number" && <p>Revenue: <strong>{fmtRs(report.revenue)}</strong></p>}
          {typeof report.grossProfit === "number" && <p>Gross profit: <strong>{fmtRs(report.grossProfit)}</strong>{report.estimated ? " (estimated)" : ""}</p>}
          {Array.isArray(report.bills) && <p>{report.bills.length} bills in range</p>}
          {Array.isArray(report.items) && <p>{report.items.length} active items; valuation {fmtRs(report.valuation as number)}</p>}
          {Array.isArray(report.transactions) && <p>{report.transactions.length} ledger entries</p>}
          {typeof report.note === "string" && <p className="border-t pt-3 text-xs text-slate-500">{report.note}</p>}
        </div>
      )}
    </section>
  );
}
