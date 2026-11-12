"use client";

import { useEffect, useRef, useState } from "react";
import { ContactRound, QrCode, ScanLine, Search, X } from "lucide-react";
import { ComingSoon } from "../../components/ComingSoon";
import { Mascot } from "../../components/Mascot";
import { SkeletonList } from "../../components/Skeleton";
import { listConnectionsForService } from "../../shared/api/connections";
import { searchClientServices } from "../../shared/constants/clientServices";
import { contactPickerSupported, pickContact, useRestoredContact } from "../../shared/lib/contactPicker";
import { toPersianDigits } from "../../shared/lib/digits";
import { CategoryGrid } from "./CategoryGrid";
import { ConnectSheet } from "./ConnectSheet";
import { ContactRequestFlow } from "./ContactRequestFlow";
import { PlacesSheet } from "./PlacesSheet";
import { ServiceListSheet, ServiceRow } from "./ServiceListSheet";
import { takeRequestDraft } from "./requestDraft";
import { ContactLookup } from "./ContactLookup";
import { ConnectionCard } from "./ConnectionCard";
import { InviteToFrfro } from "./InviteToFrfro";
import { MyCodeSheet } from "./MyCodeSheet";
import { ScanFlow } from "./ScanFlow";
import { useConnections } from "./useConnections";
import { rememberSearch } from "./searchMemory";

const searching0 = (text) => String(text).trim().length > 0;

const NOT_FOUND = {
  phone: "این شماره هنوز توی فرفرو نیست.",
  link: "این لینک مال هیچ سالن یا آرتیستی نیست.",
  name: "پیدا نشد؛ یه اسم دیگه امتحان کن."
};

/**
 * «سالن و آرتیست من» (the client's salons tab): connect to the salons and
 * artists they already go to — by phone, name, link or QR — and book from here.
 *
 * Order: the quick ways (contacts, scan, my code), the categories, then the search box with its results right under it.
 *
 * Props:
 *  - me: { name, avatar } (for the personal code sheet)
 *  - compact: the card on the client's home page — no list of connected places under it (that is the «رزرو» tab)
 *  - onOpenProfile(profile, focus?): show a salon/artist page; `focus` = { services, label } opens its services menu on those
 *  - onNotify(message)
 */
export function ConnectPage({ me = {}, compact = false, onOpenProfile: openProfile, onNotify }) {
  // The home card and the «پیدا کردن» tab each remember their own search.
  const owner = `${compact ? "home:" : ""}${me.name || ""}`;
  const { connections, loading, query, setQuery, search, connect, connectingId, restoredScrollY } = useConnections({ onNotify, memoryOwner: owner });
  // Opening a salon page swaps this screen out: remember where the client was so Back lands there (searchMemory.js).
  const onOpenProfile = (...args) => {
    rememberSearch(owner, { scrollY: window.scrollY });
    openProfile?.(...args);
  };
  const restoredRef = useRef(false);
  const ready = searching0(query) ? search.status !== "searching" : !loading;
  useEffect(() => {
    if (restoredRef.current || !ready) return;
    restoredRef.current = true;
    if (restoredScrollY > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: restoredScrollY, left: 0, behavior: "instant" }));
      rememberSearch(owner, { scrollY: 0 }); // used once
    }
  }, [ready, restoredScrollY, owner]);
  const [sheet, setSheet] = useState(""); // "" | "scan" | "code"
  const [serviceList, setServiceList] = useState(null); // the tile whose services are open
  const [checkingService, setCheckingService] = useState("");
  const [placesSheet, setPlacesSheet] = useState(null); // { service, matches }: several of mine do it
  const [requestFlow, setRequestFlow] = useState(null); // { service, mine, start? }: ask someone not on frfro yet
  const [contacts, setContacts] = useState(false); // the phone has a contact picker
  const [contact, setContact] = useState(null); // the contact picked for «از مخاطبین»
  const searching = query.trim().length > 0;
  // What the client typed may be a service («ژلیش», «اپیلاسیون»): those come first, then salons by that name.
  const serviceHits = searching ? searchClientServices(query, { limit: 5 }) : [];

  useEffect(() => { setContacts(contactPickerSupported()); }, []);

  // «از مخاطبین»: the system's own picker (it asks for access); only the chosen contact is looked up.
  async function chooseContact() {
    try {
      const picked = await pickContact("connect");
      if (picked) setContact(picked);
    } catch {
      onNotify?.("به مخاطب‌هات دسترسی نداریم؛ شماره رو توی جستجو بزن.");
    }
  }

  // A pick (here or in a category's sheet) that came back after Android closed and restarted the app.
  useRestoredContact("connect", setContact);

  // A pick from the contacts that came back after Android restarted the app mid-request (requestDraft.js).
  useRestoredContact("request", (picked) => {
    const draft = takeRequestDraft();
    if (draft) setRequestFlow({ service: draft.service, mine: true, start: { contact: picked, date: draft.date, time: draft.time } });
  });

  // «چه کاری می‌خوای؟» (owner, 2026-11-12): a tile opens its services; a service, typed or tapped, goes to the one of
  // my salons/artists that does it, lets me pick when several do, and when none does, asks someone from my contacts.
  async function pickService(service) {
    setCheckingService(service.id || "typed");
    try {
      const { ok, data } = await listConnectionsForService(service.id ? { id: service.id } : { name: service.name });
      if (!ok) {
        onNotify?.("پیدا نشد؛ دوباره بزن.");
        return;
      }
      const matches = data?.matches || [];
      setServiceList(null);
      if (matches.length === 1) {
        onOpenProfile?.(matches[0], { services: matches[0].services, label: service.name });
      } else if (matches.length > 1) {
        setPlacesSheet({ service, matches });
      } else {
        setRequestFlow({ service, mine: connections.length > 0 });
      }
    } catch {
      onNotify?.("پیدا نشد؛ دوباره بزن.");
    } finally {
      setCheckingService("");
    }
  }

  // The number the client sent to is already a salon or artist on frfro: connect and open it.
  async function openFound(profile) {
    setRequestFlow(null);
    const connected = profile.connected ? profile : await connect(profile, { silent: true });
    if (connected) onOpenProfile?.(connected, { services: [], label: "همه خدمات" });
  }

  // «وصل شو» connects and goes straight to their page to book: one tap, not two.
  async function connectAndOpen(profile) {
    const connected = await connect(profile);
    if (connected) onOpenProfile?.(connected);
  }

  const connectButton = (profile) => (profile.connected ? (
    <button type="button" className="cnPrimaryBtn" onClick={() => onOpenProfile?.(profile)}>رزرو</button>
  ) : (
    <button type="button" className="cnPrimaryBtn" disabled={connectingId === profile.id} onClick={() => connectAndOpen(profile)}>
      {connectingId === profile.id ? "…" : "وصل شو"}
    </button>
  ));

  return (
    <section className={`cnPage${compact ? " is-compact" : ""}`} aria-labelledby={compact ? "cn-home-title" : "cn-title"}>
      <header className="cnHead">
        <div className="cnHeadText">
          {compact ? <h2 id="cn-home-title">نوبت تازه بگیر</h2> : <h1 id="cn-title">چه کاری می‌خوای؟</h1>}
          {compact ? null : <p>اسم سالن یا آرتیستت رو بنویس، یا یکی از کارها رو بزن.</p>}
        </div>
        {/* The quick ways first (contacts, scan their code, show mine), then the categories; the search box
            comes last so its results sit right under it, not off-screen (owner's request 2026-10-23). */}
        <div className="cnChips">
          {contacts ? (
            <button type="button" className="cnChip" onClick={chooseContact}>
              <ContactRound size={17} aria-hidden="true" />
              از مخاطب‌ها
            </button>
          ) : null}
          <button type="button" className="cnChip is-primary" onClick={() => setSheet("scan")}>
            <ScanLine size={17} aria-hidden="true" />
            اسکن QR
          </button>
          <button type="button" className="cnChip" onClick={() => setSheet("code")}>
            <QrCode size={17} aria-hidden="true" />
            کد من
          </button>
        </div>
        <CategoryGrid onPick={setServiceList} />
        <label className="cnSearch">
          <Search size={20} aria-hidden="true" />
          <span className="srOnly">جستجوی کار، یا سالن با اسم، شماره یا لینک</span>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // The keyboard covers half the screen: bring the box up so the results under it stay in view.
            onFocus={(event) => {
              const box = event.currentTarget;
              window.setTimeout(() => box.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
            }}
            placeholder="اسم کار، سالن یا آرتیست"
            autoComplete="off"
          />
          {searching ? (
            <button type="button" className="cnSearchClear" onClick={() => setQuery("")} aria-label="پاک کردن جستجو">
              <X size={16} />
            </button>
          ) : null}
        </label>
      </header>

      {compact && !searching ? null : (
      <div className="cnBody">
        {searching ? (
          <section aria-label="نتیجه جستجو" aria-live="polite" className="cnList">
            {serviceHits.length ? (
              <div className="crServices" aria-label="کارها">
                {serviceHits.map((service) => (
                  <ServiceRow key={service.id} service={service} near={service.match === "word"} busy={checkingService === service.id} disabled={Boolean(checkingService)} onPick={pickService} />
                ))}
              </div>
            ) : null}
            {search.status === "searching" ? <SkeletonList rows={2} variant="card" label="در حال جستجو" /> : null}
            {search.status === "error" ? <p className="cnNote" role="alert">{search.message || "جستجو نشد؛ دوباره بزن."}</p> : null}
            {search.status === "done" && search.results.length === 0 && !serviceHits.length && search.by === "name" && query.trim().length > 1 ? (
              <ServiceRow
                service={{ name: query.trim().slice(0, 60), icon: "" }}
                busy={checkingService === "typed"}
                disabled={Boolean(checkingService)}
                onPick={pickService}
              />
            ) : null}
            {search.status === "done" && search.results.length === 0 && !serviceHits.length ? (
              <div className="cnEmpty is-compact">
                <b>{NOT_FOUND[search.by] || NOT_FOUND.name}</b>
                <p>اگه هنوز توی فرفرو نیست، دعوتش کن؛ که اومد، همین‌جا پیداش می‌کنی.</p>
                <InviteToFrfro phone={search.by === "phone" ? query : ""} clientName={me.name} />
              </div>
            ) : null}
            {search.status === "done" ? search.results.map((profile) => (
              <ConnectionCard key={profile.id} profile={profile} onOpen={onOpenProfile} action={connectButton(profile)} />
            )) : null}
          </section>
        ) : compact ? null : (
          <section aria-labelledby="cn-list-title" className="cnList">
            <div className="cnListHead">
              <h2 id="cn-list-title">سالن و آرتیست‌هات</h2>
              {connections.length ? <span>{toPersianDigits(connections.length)}</span> : null}
            </div>
            {loading ? <SkeletonList rows={3} variant="card" label="در حال بارگذاری" /> : null}
            {!loading && connections.length === 0 ? (
              <div className="cnEmpty">
                <Mascot pose="connect" size={130} />
                <b>هنوز به سالن یا آرتیستی وصل نشدی</b>
                <p>اسم یا شماره‌ش رو بالا بزن، یا QRش رو اسکن کن؛ بعدش نوبت گرفتن یه ضربه‌ست.</p>
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
              text="به‌زودی بهترین‌های دور و برت رو اینجا نشونت می‌دیم. فعلاً سالن و آرتیست خودت رو وصل کن."
            />
          </section>
        )}
      </div>
      )}

      {serviceList ? (
        <ServiceListSheet category={serviceList} busyId={checkingService} onPick={pickService} onClose={() => setServiceList(null)} />
      ) : null}
      {placesSheet ? (
        <PlacesSheet
          service={placesSheet.service}
          matches={placesSheet.matches}
          onOpen={(profile) => {
            const { service } = placesSheet;
            setPlacesSheet(null);
            onOpenProfile?.(profile, { services: profile.services || [], label: service.name });
          }}
          onOther={() => {
            const { service } = placesSheet;
            setPlacesSheet(null);
            setRequestFlow({ service, mine: false });
          }}
          onClose={() => setPlacesSheet(null)}
        />
      ) : null}
      {requestFlow ? (
        <ContactRequestFlow
          service={requestFlow.service}
          start={requestFlow.start || null}
          mine={requestFlow.mine}
          clientName={me.name}
          onFound={openFound}
          onScan={() => {
            setRequestFlow(null);
            setSheet("scan");
          }}
          onClose={() => setRequestFlow(null)}
        />
      ) : null}
      {contact ? (
        <ConnectSheet label="مخاطب انتخاب‌شده" title={contact.name || "مخاطب انتخاب‌شده"} subtitle="داریم توی فرفرو پیداش می‌کنیم." onClose={() => setContact(null)}>
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
