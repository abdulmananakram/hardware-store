"use client";

import { QUICK_AMOUNTS } from "@/lib/store";
import { Input } from "@/components/ui/input";

interface AmountInputProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}

export function AmountInput({ value, onChange, label, placeholder = "0" }: AmountInputProps) {
  return (
    <div className="mt-3">
      {label && (
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xl font-extrabold text-slate-700">Rs.</span>
        <Input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-2xl font-extrabold h-12 border-slate-300"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {QUICK_AMOUNTS.map((n) => (
          <button
            key={n}
            onClick={() => onChange(String(n))}
            className="flex-1 min-w-[60px] px-3 py-1.5 text-[13px] font-semibold rounded-full border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition active:scale-95"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
