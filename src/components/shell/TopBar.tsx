"use client";

import { useApp, fmtRs } from "@/lib/store";
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
        {cfg.showSync !== false && (
          <button
            onClick={pendingSync > 0 ? pushSync : undefined}
            disabled={pendingSync === 0}
            className={`shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-full transition active:scale-95 ${
              pendingSync > 0
                ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                : "bg-white/15 text-white"
            }`}
          >
            {pendingSync > 0 ? `☁ ${pendingSync} Pending` : "✓ Synced"}
          </button>
        )}
      </div>
    </header>
  );
}
