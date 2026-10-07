"use client";

import { useState } from "react";
import { useApp, stockDisplay, fmtRs } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/parts/Sheet";

const EMOJI_OPTIONS = ["📍", "🪛", "🔒", "🚪", "⚙️", "🔩", "🛠️", "🎨", "📦", "🧱", "🪚", "🛢️"];

export function ItemAddEditScreen() {
  const params = useApp((s) => s.params);
  const items = useApp((s) => s.items);
  const categories = useApp((s) => s.categories);
  const addItem = useApp((s) => s.addItem);
  const updateItem = useApp((s) => s.updateItem);
  const softDeleteItem = useApp((s) => s.softDeleteItem);
  const addCategory = useApp((s) => s.addCategory);
  const navigate = useApp((s) => s.navigate);

  const editing = params.itemId ? items.find((i) => i.id === params.itemId) : null;
  const [name, setName] = useState(editing?.name || "");
  const [urduName, setUrduName] = useState(editing?.urduName || "");
  const [icon, setIcon] = useState(editing?.icon || "📦");
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId || null);
  const [baseUnitName, setBaseUnitName] = useState(editing?.baseUnitName || "Piece");
  const [price, setPrice] = useState(editing ? String(editing.pricePerBaseUnit) : "");
  const [cost, setCost] = useState(editing?.costPerBaseUnit ? String(editing.costPerBaseUnit) : "");
  const [qty, setQty] = useState(editing ? String(editing.qtyInBaseUnit) : "0");
  const [threshold, setThreshold] = useState(editing ? String(editing.lowStockThreshold) : "10");
  const [extraUnits, setExtraUnits] = useState(
    editing
      ? editing.units.filter((u) => !u.isBaseUnit).map((u) => ({
          unitName: u.unitName,
          conversionToBase: u.conversionToBase,
        }))
      : []
  );
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📦");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState("");

  const valid =
    name.trim() &&
    categoryId &&
    baseUnitName.trim() &&
    parseFloat(price) > 0 &&
    parseFloat(threshold) >= 0;

  const handleSave = () => {
    if (!valid) {
      setErr("Fill name, category, base unit, and price");
      return;
    }
    if (editing) {
      const newPrice = parseFloat(price);
      const priceChanged = newPrice !== editing.pricePerBaseUnit;
      if (priceChanged && !confirm(`Change price from ${fmtRs(editing.pricePerBaseUnit)} to ${fmtRs(newPrice)}? Past bills are unaffected.`)) {
        return;
      }
      updateItem(editing.id, {
        name: name.trim(),
        urduName: urduName.trim() || undefined,
        icon,
        categoryId: categoryId!,
        baseUnitName: baseUnitName.trim(),
        pricePerBaseUnit: newPrice,
        costPerBaseUnit: cost ? parseFloat(cost) : undefined,
        qtyInBaseUnit: parseFloat(qty) || 0,
        lowStockThreshold: parseFloat(threshold),
        units: editing.units.map((u) => u), // existing units kept
      });
    } else {
      addItem({
        name: name.trim(),
        urduName: urduName.trim() || undefined,
        categoryId: categoryId!,
        baseUnitName: baseUnitName.trim(),
        pricePerBaseUnit: parseFloat(price),
        lowStockThreshold: parseFloat(threshold),
        icon,
        qtyInBaseUnit: parseFloat(qty) || 0,
        extraUnits,
      });
    }
    navigate("inventory");
  };

  const handleDelete = () => {
    if (!editing) return;
    const res = softDeleteItem(editing.id);
    if (!res.ok) {
      setErr(res.error || "Cannot delete");
      setConfirmDelete(false);
      return;
    }
    navigate("inventory");
  };

  return (
    <div className="px-3 pt-3 pb-32">
      <div className="space-y-3">
        {/* Icon picker */}
        <div>
          <Label className="text-[11px] font-bold uppercase text-slate-500">Icon</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setIcon(e)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl border-2 transition ${
                  icon === e
                    ? "bg-teal-50 border-teal-500"
                    : "border-slate-200 bg-white"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <Label className="text-[11px] font-bold uppercase text-slate-500">Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Steel Nail 2x8"
            className="h-11 mt-1"
          />
        </div>

        {/* Urdu name */}
        <div>
          <Label className="text-[11px] font-bold uppercase text-slate-500">Urdu Name (optional)</Label>
          <Input
            value={urduName}
            onChange={(e) => setUrduName(e.target.value)}
            placeholder="اسٹیل کیل"
            className="h-11 mt-1"
            dir="rtl"
          />
        </div>

        {/* Category */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold uppercase text-slate-500">Category *</Label>
            <button
              onClick={() => setShowNewCat(true)}
              className="text-[11px] font-bold text-teal-700 hover:underline"
            >
              + New category
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition ${
                  categoryId === c.id
                    ? "bg-teal-50 border-teal-500 text-teal-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Base unit */}
        <div>
          <Label className="text-[11px] font-bold uppercase text-slate-500">Base Unit *</Label>
          <Input
            value={baseUnitName}
            onChange={(e) => setBaseUnitName(e.target.value)}
            placeholder="e.g. Piece, Kg, Tin"
            className="h-11 mt-1"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            The smallest unit this item is tracked in (stock is stored in this unit).
          </p>
        </div>

        {/* Price + cost */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] font-bold uppercase text-slate-500">
              Price per {baseUnitName || "unit"} *
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="h-11 mt-1 font-bold"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold uppercase text-slate-500">Cost (optional)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0"
              className="h-11 mt-1"
            />
          </div>
        </div>

        {/* Qty + threshold */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] font-bold uppercase text-slate-500">Stock (in {baseUnitName || "unit"})</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="h-11 mt-1 font-bold"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold uppercase text-slate-500">Low-stock threshold</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0"
              className="h-11 mt-1"
            />
          </div>
        </div>

        {/* Extra units */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold uppercase text-slate-500">
              Additional Units (Box, Dozen…)
            </Label>
            <button
              onClick={() =>
                setExtraUnits([
                  ...extraUnits,
                  { unitName: "", conversionToBase: 1 },
                ])
              }
              className="text-[11px] font-bold text-teal-700 hover:underline"
            >
              + Add unit
            </button>
          </div>
          {extraUnits.length === 0 && (
            <p className="text-[11px] text-slate-400 mt-1">
              Optional. Add to sell in boxes etc. (e.g. Box = 12 {baseUnitName || "units"})
            </p>
          )}
          <div className="space-y-1.5 mt-1">
            {extraUnits.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={u.unitName}
                  onChange={(e) => {
                    const next = [...extraUnits];
                    next[i] = { ...next[i], unitName: e.target.value };
                    setExtraUnits(next);
                  }}
                  placeholder="Box"
                  className="h-10 flex-1"
                />
                <span className="text-slate-500 text-sm">=</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={String(u.conversionToBase)}
                  onChange={(e) => {
                    const next = [...extraUnits];
                    next[i] = { ...next[i], conversionToBase: parseFloat(e.target.value) || 1 };
                    setExtraUnits(next);
                  }}
                  className="h-10 w-20"
                />
                <span className="text-slate-500 text-xs">{baseUnitName}</span>
                <button
                  onClick={() => setExtraUnits(extraUnits.filter((_, idx) => idx !== i))}
                  className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {err && (
          <p className="text-rose-600 text-sm text-center bg-rose-50 p-2 rounded-lg">{err}</p>
        )}

        {/* Live preview */}
        {editing && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] font-bold uppercase text-slate-500">Current stock</p>
            <p className="text-lg font-bold">{stockDisplay(editing)}</p>
          </div>
        )}
      </div>

      {/* Bottom save bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-white border-t border-slate-200 z-30 p-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2">
          {editing && (
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="border-rose-200 text-rose-600 hover:bg-rose-50 font-bold h-12"
            >
              🗑
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!valid}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-extrabold h-12"
          >
            {editing ? "💾 Update Item" : "➕ Add Item"}
          </Button>
        </div>
      </div>

      {/* New category sheet */}
      <Sheet open={showNewCat} onClose={() => setShowNewCat(false)} title="New Category">
        <div className="space-y-3">
          <Input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Category name (e.g. Pipes)"
            className="h-11"
          />
          <div className="flex flex-wrap gap-1.5">
            {["📦", "🧱", "🪒", "🛢️", "🪚", "🧰", "🔩", "🪛"].map((e) => (
              <button
                key={e}
                onClick={() => setNewCatIcon(e)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl border-2 ${
                  newCatIcon === e ? "bg-teal-50 border-teal-500" : "border-slate-200"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <Button
            onClick={() => {
              if (!newCatName.trim()) return;
              const c = addCategory(newCatName.trim(), newCatIcon);
              setCategoryId(c.id);
              setNewCatName("");
              setShowNewCat(false);
            }}
            className="w-full bg-teal-600 hover:bg-teal-500 font-bold h-11"
          >
            Add Category
          </Button>
        </div>
      </Sheet>

      {/* Confirm delete */}
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete item?">
        <p className="text-sm text-slate-600">
          This will soft-delete <b>{editing?.name}</b>. It will no longer appear in inventory,
          but old bills keep referencing it.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            className="bg-rose-600 hover:bg-rose-500 font-bold"
          >
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
