"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, MessageCircle, ReceiptText, Wallet } from "lucide-react";

const dockItems = [
  { id: "wallet", label: "کیف پول", icon: Wallet },
  { id: "orders", label: "سفارش‌ها", icon: ReceiptText },
  { id: "insights", label: "گزارش‌ها", icon: BarChart3 },
  { id: "messages", label: "پیام‌ها", icon: MessageCircle }
];

export function ShopOwnerDock({
  open = false,
  activeView = "overview",
  unreadCount = 0,
  onNavigate,
  homeLogo = ""
}) {
  const [dockRoot, setDockRoot] = useState(null);

  useEffect(() => {
    setDockRoot(document.body);
  }, []);

  if (!open || !dockRoot) return null;

  const dock = (
    <nav className="shopOwnerActionDock is-floating" aria-label="ناوبری فروشگاه">
      <button type="button" className="is-primary" onClick={() => onNavigate?.("overview")} aria-label="داشبورد فروشگاه">
        <img src={homeLogo || "/cosmetics-bold-poster.png"} alt="" aria-hidden="true" />
      </button>
      {dockItems.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeView;
        return (
          <button
            type="button"
            key={item.id}
            className={active ? "is-active" : ""}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate?.(item.id)}
          >
            <span className="shopDockIconWrap">
              <Icon size={18} />
              {item.id === "messages" && unreadCount > 0 ? <em>{unreadCount}</em> : null}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return createPortal(dock, dockRoot);
}
