"use client";

import { useApp, fmtDate } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function NotificationsScreen() {
  const notifications = useApp((s) => s.notifications);
  const markNotificationRead = useApp((s) => s.markNotificationRead);
  const markAllNotificationsRead = useApp((s) => s.markAllNotificationsRead);
  const navigate = useApp((s) => s.navigate);
  const getItem = useApp((s) => s.getItem);
  const getCustomer = useApp((s) => s.getCustomer);

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const unread = sorted.filter((n) => !n.isRead).length;

  return (
    <div className="px-3 pt-3 pb-28">
      {unread > 0 && (
        <Button
          onClick={markAllNotificationsRead}
          variant="outline"
          className="w-full mb-3 font-bold h-10 border-slate-200"
        >
          ✓ Mark all read ({unread})
        </Button>
      )}

      <div className="space-y-1.5">
        {sorted.map((n) => {
          const icon = n.type === "low_stock" ? "⚠️" : "📒";
          const related =
            n.relatedItemId !== undefined
              ? getItem(n.relatedItemId)?.name
              : n.relatedCustomerId !== undefined
              ? getCustomer(n.relatedCustomerId)?.name
              : null;
          return (
            <button
              key={n.id}
              onClick={() => {
                markNotificationRead(n.id);
                if (n.relatedItemId) navigate("item-edit", { itemId: n.relatedItemId });
                else if (n.relatedCustomerId) navigate("customer-detail", { customerId: n.relatedCustomerId });
              }}
              className={`w-full bg-white rounded-xl p-3 shadow-sm border flex items-start gap-3 text-left transition active:scale-[0.98] ${
                n.isRead ? "border-slate-100 opacity-70" : "border-teal-200 bg-teal-50/30"
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-lg shrink-0">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{n.message}</p>
                {related && (
                  <p className="text-[11px] text-slate-500 mt-0.5">Tap to view: {related}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <span className="w-2 h-2 bg-teal-500 rounded-full mt-1.5 shrink-0"></span>
              )}
            </button>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">🔔</p>
            <p className="text-slate-500 text-sm">No notifications yet</p>
            <p className="text-slate-400 text-xs mt-1">
              Low-stock and khata reminders will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
