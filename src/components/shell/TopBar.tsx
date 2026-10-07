"use client";

import { useApp } from "@/lib/store";
import { ScreenId } from "@/lib/types";

interface HeaderConfig {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showSync?: boolean;
}

const CONFIG: Record<string, HeaderConfig> = {
  login: { title: "Hardware Shop", subtitle: "PIN to unlock" },
  dashboard: { title: "🔩 Hardware Shop", subtitle: "Today's overview" },
  inventory: { title: "📦 Inventory", subtitle: "Stock list & items" },
  "item-add": { title: "➕ Add Item", showBack: true },
  "item-edit": { title: "✏️ Edit Item", showBack: true },
  "item-detail": { title: "📦 Item Detail", showBack: true },
  "stock-adjust": { title: "⚖️ Stock Adjustment", showBack: true },
  "category-images": { title: "🖼️ Category Images", subtitle: "Library & defaults", showBack: true },
  "category-image-pick": { title: "🖼️ Pick Image", showBack: true },
  "sale-new": { title: "🧾 New Sale Bill", subtitle: "Quick billing" },
  "bill-history": { title: "📜 Bill History", showBack: true },
  "purchase-new": { title: "🚚 Record Purchase", showBack: true },
  return: { title: "↩️ Return Item", showBack: true },
  customers: { title: "📒 Customer Khata", subtitle: "Receivables" },
  "customer-detail": { title: "Customer Ledger", showBack: true },
  suppliers: { title: "🚚 Suppliers", subtitle: "Payables" },
  "supplier-detail": { title: "Supplier Ledger", showBack: true },
  notifications: { title: "🔔 Notifications" },
  "ai-import-review": { title: "🤖 AI Import Review", showBack: true },
  "ai-import-list": { title: "🤖 AI Import", subtitle: "Photo/PDF → items" },
  "customer-catalog": { title: "🛍️ Price List", subtitle: "Customer view" },
};

export function TopBar() {
  const screen = useApp((s) => s.screen) as ScreenId;
  const navigate = useApp((s) => s.navigate);
  const goBack = useApp((s) => s.goBack);
  const pendingSync = useApp((s) => s.pendingSyncCount());
  const pushSync = useApp((s) => s.pushSync);
  const isOnline = useApp((s) => s.isOnline);
  const setOnline = useApp((s) => s.setOnline);

  const cfg = CONFIG[screen] || CONFIG.dashboard;

  return (
    <header
      className="sticky top-0 z-30 bg-teal-700 text-white shadow-md"
      style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
    >
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {cfg.showBack && (
            <button
              onClick={goBack}
              className="shrink-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-lg font-bold transition active:scale-95"
              aria-label="Back"
            >
              ‹
            </button>
          )}
          <div className="min-w-0">
            <h1 className="font-extrabold text-[15px] leading-tight truncate">
              {cfg.title}
            </h1>
            {cfg.subtitle && (
              <p className="text-[11px] text-white/80 font-medium leading-tight truncate">
                {cfg.subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Online toggle (per resolution #1) — toggles offline-first behaviour */}
          <button
            onClick={() => setOnline(!isOnline)}
            className={`text-[10px] font-bold px-2 py-1.5 rounded-full transition active:scale-95 ${
              isOnline
                ? "bg-emerald-400/30 text-emerald-100 hover:bg-emerald-400/40"
                : "bg-rose-400/30 text-rose-100 hover:bg-rose-400/40"
            }`}
            title="Toggle network"
          >
            {isOnline ? "🌐 Online" : "📵 Offline"}
          </button>
          {cfg.showSync !== false && (
            <button
              onClick={pendingSync > 0 ? pushSync : undefined}
              disabled={pendingSync === 0}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full transition active:scale-95 ${
                pendingSync > 0
                  ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                  : "bg-white/15 text-white"
              }`}
            >
              {pendingSync > 0 ? `☁ ${pendingSync} Pending` : "✓ Synced"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
