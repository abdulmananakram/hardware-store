"use client";

import { useState } from "react";
import { useApp, fmtRs } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/parts/Sheet";
import { AiImportRow } from "@/lib/types";

// ============================================================
// AI Import List — start point (upload photo/PDF or use existing session)
// ============================================================

export function AiImportListScreen() {
  const aiSessions = useApp((s) => s.aiSessions);
  const createAiSession = useApp((s) => s.createAiSession);
  const navigate = useApp((s) => s.navigate);
  const [showSim, setShowSim] = useState(false);

  // Simulated AI extraction (the real flow would POST /api/v1/ai-import with the file)
  const simulateUpload = () => {
    const mockExtracted = [
      { name: "M14 Bolt", price: 32 },
      { name: "M14 Nut", price: 10 },
      { name: "Wall Plug 10mm", price: 3 },
      { name: "Hinge 6in", price: 180 },
      { name: "Door Stopper", price: 65 },
    ];
    const id = createAiSession(mockExtracted, "photo");
    setShowSim(false);
    navigate("ai-import-review", { aiSessionId: id });
  };

  return (
    <div className="px-3 pt-3 pb-28">
      <div className="bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white rounded-2xl p-4 shadow-lg mb-4">
        <div className="text-3xl mb-1">🤖</div>
        <h2 className="font-extrabold text-lg">AI Import Stock</h2>
        <p className="text-xs opacity-90 mt-0.5">
          Take a photo of a supplier price list or upload a PDF. AI reads item names
          & prices — you confirm quantity, base unit, and category before anything is added.
        </p>
      </div>

      <Button
        onClick={() => setShowSim(true)}
        className="w-full bg-violet-600 hover:bg-violet-500 font-extrabold h-14 text-base mb-4"
      >
        📷 Capture or Upload
      </Button>

      <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">
        Past Imports
      </h3>
      <div className="space-y-1.5">
        {aiSessions.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate("ai-import-review", { aiSessionId: s.id })}
            className="w-full bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center gap-3 text-left active:scale-95 transition"
          >
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-lg">
              {s.sourceType === "photo" ? "📷" : "📄"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Session #{s.id}</p>
              <p className="text-[11px] text-slate-500">
                {s.rawExtracted.length} items extracted
              </p>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                s.status === "confirmed"
                  ? "bg-emerald-100 text-emerald-700"
                  : s.status === "discarded"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {s.status === "confirmed"
                ? "DONE"
                : s.status === "discarded"
                ? "DISCARDED"
                : "PENDING"}
            </span>
          </button>
        ))}
        {aiSessions.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-8">No previous imports yet</p>
        )}
      </div>

      <Sheet open={showSim} onClose={() => setShowSim(false)} title="AI Import (Demo)">
        <p className="text-sm text-slate-600 mb-3">
          In the real backend this would call{" "}
          <code className="text-xs bg-slate-100 px-1 rounded">POST /api/v1/ai-import</code> with
          your file, which sends it to the Gemini API. For this demo, a mock price list will be
          simulated.
        </p>
        <Button
          onClick={simulateUpload}
          className="w-full bg-violet-600 hover:bg-violet-500 font-bold h-12"
        >
          🤖 Run AI Extraction (demo)
        </Button>
      </Sheet>
    </div>
  );
}

// ============================================================
// AI Import Review — confirm extracted rows
// Per resolution #2: confirm requires base_unit_name + low_stock_threshold per row
// ============================================================

export function AiImportReviewScreen() {
  const params = useApp((s) => s.params);
  const aiSessions = useApp((s) => s.aiSessions);
  const categories = useApp((s) => s.categories);
  const shopConfig = useApp((s) => s.shopConfig);
  const confirmAiImport = useApp((s) => s.confirmAiImport);
  const navigate = useApp((s) => s.navigate);

  const session = aiSessions.find((s) => s.id === params.aiSessionId);

  // Per resolution #2 — rows include base_unit_name and low_stock_threshold
  const [rows, setRows] = useState<AiImportRow[]>(
    session
      ? session.rawExtracted.map((r) => ({
          name: r.name,
          price: r.price,
          qty: 0,
          categoryId: null,
          baseUnitName: shopConfig.baseUnitDefault, // default from shop setting
          lowStockThreshold: shopConfig.lowStockThresholdDefault, // default from shop setting
        }))
      : []
  );
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [err, setErr] = useState("");

  if (!session) {
    return <div className="p-6 text-center text-slate-500">Session not found.</div>;
  }

  const valid = rows.every(
    (r) =>
      r.name.trim() &&
      r.price > 0 &&
      r.categoryId &&
      r.qty > 0 &&
      r.baseUnitName.trim() &&
      r.lowStockThreshold >= 0
  );

  const handleConfirm = () => {
    if (!valid) {
      setErr("Fill all rows: name, price, qty, base unit, category, threshold");
      return;
    }
    setErr("");
    const added = confirmAiImport(
      session.id,
      rows.map((r) => ({
        name: r.name,
        price: r.price,
        qty: r.qty,
        categoryId: r.categoryId!,
        baseUnitName: r.baseUnitName,
        lowStockThreshold: r.lowStockThreshold,
      }))
    );
    setDoneCount(added);
  };

  return (
    <div className="px-3 pt-3 pb-32">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-3">
        <p className="text-sm font-bold text-violet-800">🤖 AI Extraction Result</p>
        <p className="text-xs text-violet-700 mt-1">
          Review every row. Correct any wrong name/price, pick category, set base unit,
          quantity, and low-stock threshold. <b>Nothing is added to inventory until you press &quot;Add All&quot;.</b>
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const rowValid =
            r.name.trim() &&
            r.price > 0 &&
            r.categoryId &&
            r.qty > 0 &&
            r.baseUnitName.trim() &&
            r.lowStockThreshold >= 0;
          return (
            <div
              key={i}
              className={`bg-white rounded-xl p-3 shadow-sm border ${
                rowValid ? "border-slate-100" : "border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <input
                  value={r.name}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...next[i], name: e.target.value };
                    setRows(next);
                  }}
                  placeholder="Item name"
                  className="flex-1 font-bold text-sm bg-transparent border-b border-slate-200 focus:border-teal-500 outline-none py-1"
                />
                <button
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 text-sm"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Price</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={String(r.price)}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...next[i], price: parseFloat(e.target.value) || 0 };
                      setRows(next);
                    }}
                    className="h-9 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Quantity</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={r.qty ? String(r.qty) : ""}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...next[i], qty: parseInt(e.target.value) || 0 };
                      setRows(next);
                    }}
                    placeholder="0"
                    className="h-9 text-sm font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Base Unit
                  </label>
                  <Input
                    value={r.baseUnitName}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...next[i], baseUnitName: e.target.value };
                      setRows(next);
                    }}
                    placeholder="Piece"
                    className="h-9 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Low-stock at
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={String(r.lowStockThreshold)}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = {
                        ...next[i],
                        lowStockThreshold: parseFloat(e.target.value) || 0,
                      };
                      setRows(next);
                    }}
                    className="h-9 text-sm font-semibold"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Category</label>
                <select
                  value={r.categoryId || ""}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = {
                      ...next[i],
                      categoryId: e.target.value ? +e.target.value : null,
                    };
                    setRows(next);
                  }}
                  className="w-full mt-0.5 p-2 border-2 border-slate-200 rounded-lg bg-white text-sm font-semibold"
                >
                  <option value="">— Select category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {!rowValid && (
                <p className="text-[10px] text-amber-700 mt-2 font-semibold">
                  ⚠ Incomplete — fill all fields to enable &quot;Add All&quot;
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-white border-t border-slate-200 z-30 p-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {err && (
          <p className="text-rose-600 text-xs text-center mb-2 bg-rose-50 p-1.5 rounded-lg">{err}</p>
        )}
        <Button
          onClick={handleConfirm}
          disabled={!valid}
          className="w-full bg-emerald-600 hover:bg-emerald-500 font-extrabold h-12"
        >
          ➕ Add All to Inventory ({rows.length})
        </Button>
      </div>

      <Sheet
        open={doneCount !== null}
        onClose={() => {
          setDoneCount(null);
          navigate("inventory");
        }}
        title="✅ Import Complete"
      >
        {doneCount !== null && (
          <div className="text-center py-2">
            <div className="text-5xl mb-2">✅</div>
            <p className="font-extrabold text-lg">{doneCount} items added</p>
            <p className="text-sm text-slate-500 mt-1">
              Items are now in your inventory with opening stock recorded as &quot;initial&quot;
              adjustment. Ready to sell.
            </p>
            <Button
              onClick={() => {
                setDoneCount(null);
                navigate("inventory");
              }}
              className="w-full mt-4 bg-teal-600 hover:bg-teal-500 font-bold h-11"
            >
              📦 View Inventory
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
