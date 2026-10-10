"use client";

import { useState } from "react";
import { QrCode, ScanLine, Search, Share2, X } from "lucide-react";
import { Mascot } from "../../components/Mascot";
import { SkeletonList } from "../../components/Skeleton";
import { toPersianDigits } from "../../shared/lib/digits";
import { ConnectionCard } from "./ConnectionCard";
import { MyCodeSheet } from "./MyCodeSheet";
import { ScanFlow } from "./ScanFlow";
import { useConnections } from "./useConnections";

const NOT_FOUND = {
  phone: "این شماره هنوز در فرفرو نیست.",
  link: "این لینک به سالن یا آرتیستی نمی‌رسد.",
  name: "با این اسم سالن یا آرتیستی پیدا نشد."
};

/** Lets the client send their salon/artist a link to join, when the search found no one. */
function InviteToFrfro() {
  async function share() {
    const url = typeof window === "undefined" ? "" : window.location.origin;
    const text = "سلام، از این به بعد می‌خواهم از فرفرو نوبت بگیرم. اینجا ثبت‌نام کنید تا وصل شویم:";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "فرفرو", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      // share sheet dismissed / clipboard blocked: nothing to undo
    }
  }
  return (
    <button type="button" className="cnInviteBtn" onClick={share}>
      <Share2 size={16} aria-hidden="true" />
      دعوتش کن به فرفرو
    </button>
  );
}

/**
 * «سالن و آرتیست من» (the client's salons tab): connect to the salons and
 * artists they already go to — by phone, name, link or QR — and book from here.
 *
 * Props:
 *  - me: { name, avatar } (for the personal code sheet)
 *  - onOpenProfile(profile): show a salon/artist page
 *  - onNotify(message)
 */
export function ConnectPage({ me = {}, onOpenProfile, onNotify }) {
  const { connections, loading, query, setQuery, search, connect, connectingId } = useConnections({ onNotify });
  const [sheet, setSheet] = useState(""); // "" | "scan" | "code"
  const searching = query.trim().length > 0;

  const connectButton = (profile) => (profile.connected ? (
    <button type="button" className="cnPrimaryBtn" onClick={() => onOpenProfile?.(profile)}>رزرو</button>
  ) : (
    <button type="button" className="cnPrimaryBtn" disabled={connectingId === profile.id} onClick={() => connect(profile)}>
      {connectingId === profile.id ? "…" : "وصل شو"}
    </button>
  ));

  return (
    <section className="cnPage" aria-labelledby="cn-title">
      <header className="cnHead">
        <div className="cnHeadText">
          <h1 id="cn-title">سالن و آرتیست من</h1>
          <p>کسی که همیشه پیشش می‌روی را پیدا کن و از همین‌جا وقت بگیر.</p>
        </div>

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

        <div className="cnScanRow">
          <button type="button" className="cnScanBtn is-dark" onClick={() => setSheet("scan")}>
            <span aria-hidden="true"><ScanLine size={20} /></span>
            <span><b>اسکن کن</b><small>کد سالن یا آرتیست</small></span>
          </button>
          <button type="button" className="cnScanBtn" onClick={() => setSheet("code")}>
            <span aria-hidden="true"><QrCode size={20} /></span>
            <span><b>اسکن شو</b><small>کد خودت را نشان بده</small></span>
          </button>
        </div>
      </header>

      <div className="cnBody">
        {searching ? (
          <section aria-label="نتیجه جستجو" aria-live="polite" className="cnList">
            {search.status === "typingPhone" ? <p className="cnNote">شماره را کامل بنویس (۱۱ رقم)؛ بعد خودش جستجو می‌کند.</p> : null}
            {search.status === "searching" ? <SkeletonList rows={2} variant="card" label="در حال جستجو" /> : null}
            {search.status === "error" ? <p className="cnNote" role="alert">{search.message || "جستجو انجام نشد؛ دوباره امتحان کن."}</p> : null}
            {search.status === "done" && search.results.length === 0 ? (
              <div className="cnEmpty is-compact">
                <b>{NOT_FOUND[search.by] || NOT_FOUND.name}</b>
                <p>اگر هنوز در فرفرو نیست، دعوتش کن؛ بعد از ثبت‌نام همین‌جا پیدایش می‌کنی.</p>
                <InviteToFrfro />
              </div>
            ) : null}
            {search.status === "done" ? search.results.map((profile) => (
              <ConnectionCard key={profile.id} profile={profile} onOpen={onOpenProfile} action={connectButton(profile)} />
            )) : null}
          </section>
        ) : (
          <section aria-labelledby="cn-list-title" className="cnList">
            <div className="cnListHead">
              <h2 id="cn-list-title">وصل‌شده‌ها</h2>
              {connections.length ? <span>{toPersianDigits(connections.length)}</span> : null}
            </div>
            {loading ? <SkeletonList rows={3} variant="card" label="در حال بارگذاری" /> : null}
            {!loading && connections.length === 0 ? (
              <div className="cnEmpty">
                <Mascot pose="search" size={130} />
                <b>هنوز به سالن یا آرتیستی وصل نشدی</b>
                <p>شماره یا اسمش را بالا بنویس، یا کدش را اسکن کن.</p>
              </div>
            ) : null}
            {connections.map((profile) => (
              <ConnectionCard
                key={profile.id}
                profile={profile}
                onOpen={onOpenProfile}
                action={<button type="button" className="cnPrimaryBtn" onClick={() => onOpenProfile?.(profile)}>رزرو</button>}
              />
            ))}
          </section>
        )}
      </div>

      {sheet === "scan" ? <ScanFlow viewerType="client" connect={connect} onOpenProfile={onOpenProfile} onClose={() => setSheet("")} /> : null}
      {sheet === "code" ? <MyCodeSheet name={me.name} avatar={me.avatar} onClose={() => setSheet("")} /> : null}
    </section>
  );
}
