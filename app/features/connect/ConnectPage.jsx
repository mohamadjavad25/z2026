"use client";

import { useEffect, useState } from "react";
import { ContactRound, QrCode, ScanLine, Search, X } from "lucide-react";
import { ComingSoon } from "../../components/ComingSoon";
import { Mascot } from "../../components/Mascot";
import { SkeletonList } from "../../components/Skeleton";
import { listConnectionsForCategory } from "../../shared/api/connections";
import { contactPickerSupported, pickContact } from "../../shared/lib/contactPicker";
import { toPersianDigits } from "../../shared/lib/digits";
import { CategoryGrid } from "./CategoryGrid";
import { CategorySheet } from "./CategorySheet";
import { ConnectSheet } from "./ConnectSheet";
import { ContactLookup } from "./ContactLookup";
import { ConnectionCard } from "./ConnectionCard";
import { InviteToFrfro } from "./InviteToFrfro";
import { MyCodeSheet } from "./MyCodeSheet";
import { ScanFlow } from "./ScanFlow";
import { useConnections } from "./useConnections";

const NOT_FOUND = {
  phone: "این شماره هنوز در فرفرو نیست.",
  link: "این لینک به سالن یا آرتیستی نمی‌رسد.",
  name: "با این اسم سالن یا آرتیستی پیدا نشد."
};

/**
 * «سالن و آرتیست من» (the client's salons tab): connect to the salons and
 * artists they already go to — by phone, name, link or QR — and book from here.
 *
 * Props:
 *  - me: { name, avatar } (for the personal code sheet)
 *  - onOpenProfile(profile, focus?): show a salon/artist page; `focus` = { services, label } opens its services menu on those
 *  - onNotify(message)
 */
export function ConnectPage({ me = {}, onOpenProfile, onNotify }) {
  const { connections, loading, query, setQuery, search, connect, connectingId, refresh } = useConnections({ onNotify });
  const [sheet, setSheet] = useState(""); // "" | "scan" | "code"
  const [categorySheet, setCategorySheet] = useState(null); // { category, matches } while the pick/connect sheet is open
  const [checkingCategory, setCheckingCategory] = useState("");
  const [contacts, setContacts] = useState(false); // the phone has a contact picker
  const [contact, setContact] = useState(null); // the contact picked for «از مخاطبین»
  const [searchOpen, setSearchOpen] = useState(false);
  const searching = query.trim().length > 0;
  const showSearch = searchOpen || searching;

  useEffect(() => { setContacts(contactPickerSupported()); }, []);

  // «از مخاطبین»: the system's own picker (it asks for access); only the chosen contact is looked up.
  async function chooseContact() {
    try {
      const picked = await pickContact();
      if (picked) setContact(picked);
    } catch {
      onNotify?.("دسترسی به مخاطبین ممکن نشد؛ شماره را در جستجو بزن.");
      setSearchOpen(true);
    }
  }

  // «چه کاری می‌خواهی؟»: one of my salons/artists does it -> straight to them, on that service;
  // several -> pick; none -> connect someone.
  async function pickCategory(category) {
    setCheckingCategory(category.id);
    try {
      const { ok, data } = await listConnectionsForCategory(category.id);
      if (!ok) {
        onNotify?.("پیدا کردن انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      const matches = data?.matches || [];
      if (matches.length === 1) {
        onOpenProfile?.(matches[0], { services: matches[0].services, label: category.label });
        return;
      }
      setCategorySheet({ category, matches });
    } catch {
      onNotify?.("پیدا کردن انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setCheckingCategory("");
    }
  }

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
          <h1 id="cn-title">چه کاری می‌خواهی؟</h1>
          <p>یکی را بزن. اگر سالن یا آرتیستش را داری، مستقیم می‌روی.</p>
        </div>
        <CategoryGrid busyId={checkingCategory} onPick={pickCategory} />

        <div className="cnConnect">
          <span className="cnConnectLabel">سالن یا آرتیستت را وصل کن</span>
          <div className="cnChips">
            {contacts ? (
              <button type="button" className="cnChip is-primary" onClick={chooseContact}>
                <ContactRound size={17} aria-hidden="true" />
                از مخاطبین
              </button>
            ) : null}
            <button type="button" className="cnChip" aria-expanded={showSearch} onClick={() => setSearchOpen((open) => !open)}>
              <Search size={17} aria-hidden="true" />
              جستجو
            </button>
            <button type="button" className={`cnChip${contacts ? "" : " is-primary"}`} onClick={() => setSheet("scan")}>
              <ScanLine size={17} aria-hidden="true" />
              اسکن QR
            </button>
            <button type="button" className="cnChip" onClick={() => setSheet("code")}>
              <QrCode size={17} aria-hidden="true" />
              کد من
            </button>
          </div>
          {showSearch ? (
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
          ) : null}
        </div>
      </header>

      <div className="cnBody">
        {searching ? (
          <section aria-label="نتیجه جستجو" aria-live="polite" className="cnList">
            {search.status === "searching" ? <SkeletonList rows={2} variant="card" label="در حال جستجو" /> : null}
            {search.status === "error" ? <p className="cnNote" role="alert">{search.message || "جستجو انجام نشد؛ دوباره امتحان کن."}</p> : null}
            {search.status === "done" && search.results.length === 0 ? (
              <div className="cnEmpty is-compact">
                <b>{NOT_FOUND[search.by] || NOT_FOUND.name}</b>
                <p>اگر هنوز در فرفرو نیست، دعوتش کن؛ بعد از ثبت‌نام همین‌جا پیدایش می‌کنی.</p>
                <InviteToFrfro phone={search.by === "phone" ? query : ""} clientName={me.name} />
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
                <p>بالا پیدایش کن: از مخاطبین، با جستجو یا با اسکن کد.</p>
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
            <ComingSoon
              className="is-compact"
              title="پیشنهاد سالن و آرتیست از فرفرو"
              text="به‌زودی بهترین‌های اطرافت را اینجا پیشنهاد می‌دهیم. فعلا سالن و آرتیست خودت را وصل کن."
            />
          </section>
        )}
      </div>

      {categorySheet ? (
        <CategorySheet
          category={categorySheet.category}
          matches={categorySheet.matches}
          hasConnections={connections.length > 0}
          clientName={me.name}
          onNotify={onNotify}
          onConnected={() => refresh()}
          onOpen={(profile, services) => {
            const category = categorySheet.category;
            setCategorySheet(null);
            onOpenProfile?.(profile, { services, label: category.label });
          }}
          onScan={() => {
            setCategorySheet(null);
            setSheet("scan");
          }}
          onClose={() => setCategorySheet(null)}
        />
      ) : null}
      {contact ? (
        <ConnectSheet label="مخاطب انتخاب‌شده" title={contact.name || "مخاطب انتخاب‌شده"} subtitle="دنبال فرفرو می‌گردیم." onClose={() => setContact(null)}>
          <ContactLookup
            contact={contact}
            clientName={me.name}
            connectingId={connectingId}
            onConnect={async (profile) => {
              const connected = await connect(profile, { silent: true });
              if (!connected) return;
              setContact(null);
              onOpenProfile?.(connected);
            }}
            onOpen={(profile) => {
              setContact(null);
              onOpenProfile?.(profile);
            }}
          />
        </ConnectSheet>
      ) : null}
      {sheet === "scan" ? <ScanFlow viewerType="client" connect={connect} onOpenProfile={onOpenProfile} onClose={() => setSheet("")} /> : null}
      {sheet === "code" ? <MyCodeSheet name={me.name} avatar={me.avatar} onClose={() => setSheet("")} /> : null}
    </section>
  );
}
