"use client";

import { ClientPlaces } from "./ClientPlaces";

const TABS = [
  { id: "mine", label: "سالن و آرتیست من" },
  { id: "explore", label: "پیدا کردن" }
];

/**
 * The client's «رزرو» tab, two tabs: «سالن و آرتیست من» (the default: the places they follow, with their
 * services) and «پیدا کردن» (`explore`: categories, search, QR — the connect page). The chosen tab
 * is held by the parent so it survives opening a salon page and coming back.
 */
export function ClientBookTabs({ tab = "mine", onTabChange, bookings = [], clientName = "", onOpenPlace, onNotify, explore }) {
  const current = tab === "explore" ? "explore" : "mine";
  return (
    <div className="cbtWrap">
      <div className="cbtTabs" role="tablist" aria-label="رزرو">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`cbt-tab-${item.id}`}
            aria-selected={current === item.id}
            aria-controls="cbt-panel"
            className={current === item.id ? "is-on" : ""}
            onClick={() => onTabChange?.(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div id="cbt-panel" role="tabpanel" aria-labelledby={`cbt-tab-${current}`}>
        {current === "mine" ? (
          <ClientPlaces
            bookings={bookings}
            clientName={clientName}
            onOpenPlace={onOpenPlace}
            onFindPlaces={() => onTabChange?.("explore")}
            onNotify={onNotify}
          />
        ) : explore}
      </div>
    </div>
  );
}
