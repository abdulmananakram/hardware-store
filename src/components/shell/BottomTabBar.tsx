"use client";

import { useApp } from "@/lib/store";
import { ScreenId } from "@/lib/types";

interface TabDef {
  id: ScreenId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: "dashboard", label: "Home", icon: "🏠" },
  { id: "inventory", label: "Stock", icon: "📦" },
  { id: "sale-new", label: "Sale", icon: "🧾" },
  { id: "customers", label: "Khata", icon: "📒" },
  { id: "notifications", label: "Alerts", icon: "🔔" },
];

export function BottomTabBar() {
  const screen = useApp((s) => s.screen);
  const navigate = useApp((s) => s.navigate);
  const notifications = useApp((s) => s.notifications);
  const unread = notifications.filter((n) => !n.isRead).length;
  const pendingSync = useApp((s) => s.pendingSyncCount());

  if (screen === "login") return null;

  // Hide tab bar only on truly modal detail screens
  const MODAL_SCREENS: ScreenId[] = [
    "customer-detail",
    "supplier-detail",
    "bill-history",
    "return",
    "ai-import-review",
    "item-edit",
    "item-add",
    "item-detail",
    "stock-adjust",
    "category-images",
    "category-image-pick",
  ];
  if (MODAL_SCREENS.includes(screen)) return null;

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[560px] bg-slate-900 text-white flex justify-around items-stretch"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
      {TABS.map((t) => {
        const active = screen === t.id;
        const badge =
          t.id === "notifications" && unread > 0
            ? unread
            : t.id === "sale-new" && pendingSync > 0
            ? pendingSync
            : 0;
        if (t.id === "sale-new") {
          return (
            <button
              key={t.id}
              onClick={() => navigate("sale-new")}
              className="flex-1 py-2 flex flex-col items-center justify-center gap-0.5 relative"
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shadow-lg transition -mt-3 ${
                  active
                    ? "bg-teal-400 text-slate-900 ring-2 ring-white"
                    : "bg-teal-600 text-white"
                }`}
              >
                {t.icon}
              </div>
              <span className="text-[10px] font-semibold mt-0.5">{t.label}</span>
            </button>
          );
        }
        return (
          <button
            key={t.id}
            onClick={() => navigate(t.id)}
            className={`flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 relative transition ${
              active ? "text-teal-300" : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="text-[10px] font-semibold">{t.label}</span>
            {badge > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-3 -translate-y-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
