"use client";

import { Crown, LayoutGrid, MessageCircle, ShoppingBag, Sparkles, Store } from "lucide-react";

export function ShellSidebar({ activeTab = "feed", onNavigate }) {
  const navItems = [
    { id: "salons", label: "سالن‌ها", Icon: Store },
    { id: "feed", label: "اکسپلور", Icon: LayoutGrid },
    { id: "chat", label: "چت", Icon: MessageCircle },
    { id: "shops", label: "فروشگاه", Icon: ShoppingBag }
  ];

  function handleNavigate(event, tab) {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(tab);
  }

  return (
    <aside className="sidebar" aria-label="ناوبری زیبابان">
      <a className="appBrand" href="#feed" onClick={(event) => handleNavigate(event, "feed")}>
        <span className="brandMark"><Sparkles size={22} /></span>
        <span>زیبابان</span>
      </a>
      <nav className="sideNav">
        {navItems.map(({ id, label, Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className={activeTab === id ? "active" : ""}
            onClick={(event) => handleNavigate(event, id)}
          >
            <Icon size={19} /> {label}
          </a>
        ))}
      </nav>
      <div className="sidePanel">
        <Crown size={22} />
        <b>Beauty Concierge</b>
        <span>پیشنهادهای شخصی، سالن‌های منتخب و مسیر رزرو بدون سردرگمی.</span>
        <button type="button">ارتقا به پریمیوم</button>
      </div>
    </aside>
  );
}
