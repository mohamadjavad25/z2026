"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ScanLine, Search, X } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { SkeletonList } from "../../components/Skeleton";
import { listConnectionsForCategory } from "../../shared/api/connections";
import { ConnectionAvatar, ConnectionCard } from "./ConnectionCard";
import { InviteToFrfro } from "./InviteToFrfro";
import { useConnections } from "./useConnections";

const NOT_FOUND = {
  phone: "این شماره هنوز در فرفرو نیست.",
  link: "این لینک به سالن یا آرتیستی نمی‌رسد.",
  name: "با این اسم سالن یا آرتیستی پیدا نشد."
};

/**
 * What happens after a client taps a category («ناخن», «مو»…) and more than one of their salons/artists
 * does it, or none does:
 *  - several: pick one (each shows which of its services match);
 *  - none: connect someone, by phone/name/link or QR, and if they aren't on frfro, invite them.
 * One match never gets here: the page opens it directly.
 *
 * Props:
 *  - category, matches: from /api/connections/by-category
 *  - hasConnections: the client already has someone connected (just not for this)
 *  - onOpen(profile, services): open the profile on those services
 *  - onScan(): open the QR scanner
 *  - onConnected(profile): a new connection was made here (so the page's list refreshes)
 */
export function CategorySheet({ category, matches = [], hasConnections = false, clientName = "", onOpen, onScan, onConnected, onNotify, onClose }) {
  const [finding, setFinding] = useState(matches.length === 0);
  // This sheet has its own search box and results; the page's own search is left alone.
  const { query, setQuery, search, connect, connectingId } = useConnections({ onNotify, load: false });
  const searching = query.trim().length > 0;

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const servicesOf = (profile) => matches.find((match) => match.id === profile.id)?.services || [];

  async function connectAndOpen(profile) {
    const connected = await connect(profile, { silent: true });
    if (!connected) return;
    onConnected?.(connected);
    // The new connection may do this category too: open it on those services.
    let services = [];
    try {
      const { ok, data } = await listConnectionsForCategory(category.id);
      if (ok) services = data?.matches?.find((match) => match.id === connected.id)?.services || [];
    } catch {
      // opening the profile still works without the matched names
    }
    onOpen?.(connected, services);
  }

  const subtitle = matches.length
    ? "چند جا برای این کار داری؛ یکی را انتخاب کن."
    : hasConnections
      ? "سالن و آرتیست‌هایی که داری این خدمت را ندارند."
      : "هنوز کسی را وصل نکرده‌ای.";

  return createPortal(
    <div className="cnSheetRoot" role="dialog" aria-modal="true" aria-label={category.label}>
      <button type="button" className="cnSheetDim" aria-label="بستن" onClick={onClose} />
      <div className="cnSheetPanel">
        <span className="cnSheetGrab" aria-hidden="true" />
        <div className="cnSheetHead">
          <ServiceIcon emoji={category.icon} name={category.label} size="sm" />
          <div>
            <b>{category.label}</b>
            <small>{subtitle}</small>
          </div>
          <button type="button" className="cnSheetClose" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </div>

        {matches.length ? (
          <div className="cnPicks">
            {matches.map((profile) => (
              <article className="cnPick" key={profile.id}>
                <button type="button" className="cnPickMain" onClick={() => onOpen?.(profile, profile.services || [])} aria-label={`رزرو از ${profile.name}`}>
                  <ConnectionAvatar profile={profile} size={46} />
                  <span className="cnPickText">
                    <b>{profile.name}</b>
                    <small>{(profile.services || []).slice(0, 3).join(" · ")}</small>
                  </span>
                </button>
                <button type="button" className="cnPrimaryBtn" onClick={() => onOpen?.(profile, profile.services || [])}>رزرو</button>
              </article>
            ))}
          </div>
        ) : null}

        {matches.length && !finding ? (
          <button type="button" className="cnSheetMore" onClick={() => setFinding(true)}>
            سالن یا آرتیست دیگری می‌خواهم
          </button>
        ) : null}

        {finding ? (
          <div className="cnFindBlock">
            <p className="cnFindHint">
              {matches.length
                ? "شماره، اسم یا لینک سالن یا آرتیست را بزن، یا QR او را اسکن کن."
                : "شمارهٔ سالن یا آرتیستی که می‌شناسی را بزن، یا QR او را اسکن کن."}
            </p>
            <label className="cnSearch">
              <Search size={20} aria-hidden="true" />
              <span className="srOnly">جستجو با شماره، اسم یا لینک</span>
              <input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="شماره، اسم یا لینک صفحه"
                autoComplete="off"
              />
              {searching ? (
                <button type="button" className="cnSearchClear" onClick={() => setQuery("")} aria-label="پاک کردن جستجو">
                  <X size={16} />
                </button>
              ) : null}
            </label>

            {searching ? (
              <section className="cnList" aria-live="polite" aria-label="نتیجه جستجو">
                {search.status === "searching" ? <SkeletonList rows={1} variant="card" label="در حال جستجو" /> : null}
                {search.status === "error" ? <p className="cnNote" role="alert">{search.message || "جستجو انجام نشد؛ دوباره امتحان کن."}</p> : null}
                {search.status === "done" && search.results.length === 0 ? (
                  <div className="cnEmpty is-compact">
                    <b>{NOT_FOUND[search.by] || NOT_FOUND.name}</b>
                    <p>اگر هنوز در فرفرو نیست، دعوتش کن؛ بعد از ثبت‌نام می‌توانی از او نوبت بگیری.</p>
                    <InviteToFrfro phone={search.by === "phone" ? query : ""} clientName={clientName} category={category.label} />
                  </div>
                ) : null}
                {search.status === "done" ? search.results.map((profile) => (
                  <ConnectionCard
                    key={profile.id}
                    profile={profile}
                    action={profile.connected ? (
                      <button type="button" className="cnPrimaryBtn" onClick={() => onOpen?.(profile, servicesOf(profile))}>رزرو</button>
                    ) : (
                      <button type="button" className="cnPrimaryBtn" disabled={connectingId === profile.id} onClick={() => connectAndOpen(profile)}>
                        {connectingId === profile.id ? "…" : "وصل شو"}
                      </button>
                    )}
                  />
                )) : null}
              </section>
            ) : null}

            <button type="button" className="cnScanBtn is-dark" onClick={onScan}>
              <span aria-hidden="true"><ScanLine size={20} /></span>
              <span><b>اسکن QR</b><small>کد سالن یا آرتیست را بگیر</small></span>
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
