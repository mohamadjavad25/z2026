"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LogOut, MapPin, MoreHorizontal, QrCode, ScanLine, Store, X } from "lucide-react";
import { Mascot } from "../../components/Mascot";
import { ProfileQrCodeSheet } from "../../components/ProfileQrCodeSheet";
import { usePolling } from "../../shared/lib/usePolling";
import { SalonRulesNote } from "../salons/SalonRulesNote";
import { TermsChips } from "../collab/TermsEditor";
import { NEGOTIABLE } from "../collab/collabPresets";
import { ScanFlow } from "../connect/ScanFlow";
import { ArtistSalonDetails, ArtistSelfSheet } from "./ArtistSalonDetails";
import { LeaveCard } from "../team/LeaveSheet";
import { ProfileSheet } from "../profile/ProfileSheet";
import { getArtistPlace, previewArtistPlace, saveArtistPlace } from "../../shared/api/artists";
import { dateKeyAfter } from "../../shared/lib/artistPlace";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { toPersianDigits } from "../../shared/lib/digits";

const PENDING_INVITE = "در انتظار تایید";
const SWITCH_DAYS = 14;

const dayLabel = (key) => formatRelativeBookingDayLabel(key);
const fromLabel = (key) => {
  const label = dayLabel(key);
  return label === "امروز" ? "از امروز" : label === "فردا" ? "از فردا" : `از ${label}`;
};

/** The salon's cover (or the app's violet pattern) behind a wallet card. */
function WalletCover({ poster, position }) {
  return (
    <span className="clwCover" aria-hidden="true">
      {poster ? <img src={poster} alt="" loading="lazy" style={{ objectPosition: position || "50% 50%" }} /> : null}
    </span>
  );
}

/** «سالن رز» → «ر»: the word "salon" is in most names and says nothing. */
const initialOf = (name) => String(name || "").trim().replace(/^سالن\s+/, "").slice(0, 1);

function WalletAvatar({ src, name }) {
  return (
    <span className="clwAvatar" aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : initialOf(name) || <Store size={18} />}
    </span>
  );
}

/** One wallet card: a salon of the artist's team, or a salon inviting them. */
function WalletCard({ card, active, menuOpen, onMenu, onLeave, leaveBusy, onFocus }) {
  return (
    <article
      className={`clwCard${active ? " is-active" : ""}${card.kind === "invite" ? " is-invite" : ""}`}
      aria-label={card.name}
      onClick={onFocus}
    >
      <WalletCover poster={card.poster} position={card.posterPosition} />
      <div className="clwTop">
        <span className={`clwBadge is-${card.badgeTone}`}>{card.badge}</span>
        {card.kind === "team" ? (
          <button
            type="button"
            className="clwMore"
            aria-label={`بیشتر برای ${card.name}`}
            aria-expanded={menuOpen}
            onClick={(event) => { event.stopPropagation(); onMenu(); }}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="clwWho">
        <WalletAvatar src={card.avatar} name={card.name} />
        <span>
          <b>{card.name}</b>
          {card.area ? <small>{card.area}</small> : null}
        </span>
      </div>
      {menuOpen ? (
        <div className="clwMenu" role="menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" className="is-danger" disabled={leaveBusy} onClick={onLeave}>
            <LogOut size={14} aria-hidden="true" />
            ترک تیم
          </button>
        </div>
      ) : null}
    </article>
  );
}

/** Days, hours and the artist's share as three small boxes; the rest of the terms stay as chips. */
function TermsFacts({ terms }) {
  const share = terms.share ? (terms.share === NEGOTIABLE ? "توافقی" : `${toPersianDigits(terms.share)}٪`) : "";
  const hours = terms.from && terms.to ? `${terms.from} تا ${terms.to}` : "";
  const facts = [
    terms.days ? { k: "روزها", v: terms.days } : null,
    hours ? { k: "ساعت", v: hours } : null,
    share ? { k: "سهم تو", v: share } : null
  ].filter(Boolean);
  if (!facts.length) return null;
  return (
    <div className="clwFacts" style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
      {facts.map((fact) => (
        <span key={fact.k}><small>{fact.k}</small><b>{fact.v}</b></span>
      ))}
    </div>
  );
}

/** «مشتری‌های خودت میان اینجا» for one salon: on when it is the artist's workplace. */
function WhereRow({ card, workplace, onTurnOn, onTurnOff }) {
  const info = workplace?.teams?.find((team) => team.salonId === card.salonId) || {};
  const isHere = workplace?.current === card.salonId;
  const blocked = info.allowed === false;
  const away = Boolean(info.away);
  const currentName = workplace?.teams?.find((team) => team.salonId === workplace?.current)?.name || "";
  let note;
  if (blocked) note = `${card.name} فعلاً مشتری‌های خودت رو قبول نمی‌کنه؛ میان جای خودت.`;
  else if (away) note = "توی این سالن مرخصی یا غیرفعالی؛ مشتری‌هات میان جای خودت.";
  else if (isHere) note = "مشتری‌هات آدرس این سالن رو می‌بینن و میان اینجا.";
  else if (currentName) note = `الان مشتری‌هات میان ${currentName}.`;
  else note = "خاموشه؛ مشتری‌هات میان جای خودت.";
  return (
    <div className={`clwWhere${isHere ? " is-on" : ""}`}>
      <span className="clwWhereIcon" aria-hidden="true"><MapPin size={17} /></span>
      <span className="clwWhereText">
        <b>مشتری‌های خودت میان اینجا</b>
        <small>{note}</small>
      </span>
      <button
        type="button"
        className="plSwitch"
        role="switch"
        aria-checked={isHere}
        aria-label={`مشتری‌های خودت میان ${card.name}`}
        disabled={!workplace || ((blocked || away) && !isHere)}
        onClick={() => (isHere ? onTurnOff() : onTurnOn())}
      />
    </div>
  );
}

/** One of the artist's bookings in the «اینا هم بیان …؟» list. */
function SwitchBooking({ booking, closed }) {
  return (
    <li className={`clwBk${closed ? " is-stay" : ""}`}>
      <b>{booking.clientFirstName || "مشتری"}{booking.service ? `، ${booking.service}` : ""}</b>
      <span>{dayLabel(booking.date)}، ساعت {toPersianDigits(String(booking.time || ""))}</span>
      {closed ? <em>سالن اون ساعت بسته‌ست؛ همین‌جا می‌مونه.</em> : null}
    </li>
  );
}

/**
 * The sheet that changes where the artist's own clients go (owner's decision of 2026-10-26: one question a step).
 * Step one asks from when («از همین الان» / «از فردا» / «یه روز دیگه»); step two comes only when bookings from then on
 * would move, lists them and asks whether they come too; with none, it saves right away. `target` is
 * { salonId | null, name }. `ask` replaces step one with the question right after accepting a salon's invite.
 */
function SwitchSheet({ target, ask, busy, error, onSave, onClose }) {
  const [when, setWhen] = useState("now"); // "now" | "tomorrow" | "other"
  const [otherDay, setOtherDay] = useState("");
  const [preview, setPreview] = useState(null); // { startsOn, moving, staying }
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  useEffect(() => { setWhen("now"); setOtherDay(""); setPreview(null); setLoadError(""); }, [target?.salonId, ask]);
  if (!target) return null;
  const toOwn = !target.salonId;
  const where = toOwn ? "جای خودت" : target.name;
  const otherDays = Array.from({ length: SWITCH_DAYS - 2 }, (_, index) => dateKeyAfter(index + 2));
  const startsOn = when === "now" ? dateKeyAfter(0) : when === "tomorrow" ? dateKeyAfter(1) : otherDay;
  const working = busy || loading;

  // Which bookings would move: none → save at once; some → step two.
  async function next(day) {
    if (!day || working) return;
    setLoading(true);
    setLoadError("");
    try {
      const { ok, data, payload } = await previewArtistPlace(target.salonId, day);
      if (!ok) { setLoadError(payload?.error || "نشد؛ دوباره بزن."); return; }
      const moving = data?.moving || [];
      if (!moving.length) { onSave({ startsOn: day, moveBookings: true }); return; }
      setPreview({ startsOn: day, moving, staying: data?.staying || [] });
    } catch {
      setLoadError("نشد؛ دوباره بزن.");
    } finally {
      setLoading(false);
    }
  }

  const problem = loadError || error;
  const problemNote = problem ? <p className="clwMsg is-bad" role="alert">{problem}</p> : null;

  if (preview) {
    const count = preview.moving.length;
    const since = preview.startsOn === dateKeyAfter(0) ? "از الان به بعد" : `${fromLabel(preview.startsOn)} به بعد`;
    return (
      <ProfileSheet
        open
        kicker={`نوبت‌هات ${since}`}
        title={count === 1 ? `این نوبت هم بیاد ${where}؟` : `این ${toPersianDigits(count)} نوبت هم بیان ${where}؟`}
        panelClassName="clwSheet"
        onClose={onClose}
      >
        <p className="clwSheetText">{count === 1 ? `این نوبتیه که ${since} داری.` : `این‌ها نوبت‌هایی‌ان که ${since} داری.`}</p>
        <ul className="clwBks">
          {preview.moving.map((booking) => <SwitchBooking key={booking.id} booking={booking} />)}
          {preview.staying.map((booking) => <SwitchBooking key={booking.id} booking={booking} closed />)}
        </ul>
        <p className="clwNote">به مشتری‌هاشون خبر می‌دیم. ساعتشون عوض نمی‌شه.</p>
        {problemNote}
        <div className="clwSheetStack">
          <button type="button" className="clwBtn is-primary is-wide" disabled={busy} onClick={() => onSave({ startsOn: preview.startsOn, moveBookings: true })}>
            {`آره، ${count === 1 ? "بیاد" : "بیان"} ${where}`}
          </button>
          <button type="button" className="clwBtn is-ghost is-wide" disabled={busy} onClick={() => onSave({ startsOn: preview.startsOn, moveBookings: false })}>
            {count === 1 ? "نه، همین‌جا بمونه" : "نه، همین‌جا بمونن"}
          </button>
        </div>
      </ProfileSheet>
    );
  }

  if (ask) {
    return (
      <ProfileSheet open kicker={target.name} title={`مشتری‌هایی که خودشون ازت نوبت می‌گیرن هم بیان ${target.name}؟`} panelClassName="clwSheet" onClose={onClose}>
        <p className="clwSheetText">اگه آره، آدرس {target.name} روی صفحه‌ت نوشته می‌شه و مشتری‌هات از همین الان میان اونجا. نوبت‌ها به اسم خودت می‌مونن و مشتری‌ها هم مال خودتن. هر وقت خواستی از همین تب عوضش کن.</p>
        {problemNote}
        <div className="clwSheetActions">
          <button type="button" className="clwBtn is-ghost" disabled={working} onClick={onClose}>نه، بیان جای خودم</button>
          <button type="button" className="clwBtn is-primary" disabled={working} onClick={() => next(dateKeyAfter(0))}>{loading ? "یه لحظه…" : "آره، بیان اینجا"}</button>
        </div>
      </ProfileSheet>
    );
  }

  const choices = [
    { key: "now", label: "از همین الان" },
    { key: "tomorrow", label: "از فردا" },
    { key: "other", label: "یه روز دیگه", hint: "روزش رو انتخاب کن" }
  ];
  return (
    <ProfileSheet open kicker={where} title={`مشتری‌هات از کی بیان ${where}؟`} panelClassName="clwSheet" onClose={onClose}>
      <div className="clwChoices" role="radiogroup" aria-label="از کی">
        {choices.map((choice) => (
          <button
            type="button"
            key={choice.key}
            role="radio"
            aria-checked={when === choice.key}
            className={when === choice.key ? "is-on" : ""}
            onClick={() => setWhen(choice.key)}
          >
            <b>{choice.label}</b>
            {choice.hint ? <small>{choice.hint}</small> : null}
          </button>
        ))}
      </div>
      {when === "other" ? (
        <div className="clwDays" role="radiogroup" aria-label="از کدوم روز">
          {otherDays.map((key) => (
            <button type="button" key={key} role="radio" aria-checked={otherDay === key} className={otherDay === key ? "is-on" : ""} onClick={() => setOtherDay(key)}>
              {dayLabel(key)}
            </button>
          ))}
        </div>
      ) : null}
      {problemNote}
      <button type="button" className="clwBtn is-primary is-wide" disabled={working || !startsOn} onClick={() => next(startsOn)}>
        {loading ? "یه لحظه…" : "ادامه"}
      </button>
    </ProfileSheet>
  );
}

/**
 * Artist owner — collaboration tab (owner's choice of 2026-10-25: wallet cards). The salons the artist is on the team
 * of and the salons inviting them are cards in one row the artist swipes; under the row, the card in view: its terms,
 * «مشتری‌های خودت میان اینجا» (the artist's one workplace at a time) and its rules. «اسکن کن» and «کد من» stay
 * under the cards (titled «یه سالن دیگه هم اضافه کن» once on a team), so a second salon can be added; no team and no
 * invite: only those two.
 */
export function ArtistCollabBoard({
  artistId,
  artistName = "",
  invites = [],
  proposals = [],
  teams = [],
  teamBusyId = "",
  inviteRespondBusyId = "",
  onInviteRespond,
  onCancelProposal,
  onLeaveTeam,
  onNotice,
  onChanged
}) {
  const [sheet, setSheet] = useState(""); // "" | "scan" | "code"
  const [workplace, setWorkplace] = useState(null);
  const [active, setActive] = useState(0);
  const [menuFor, setMenuFor] = useState("");
  const [switchTo, setSwitchTo] = useState(null); // { salonId | null, name, ask? }
  const [selfFor, setSelfFor] = useState(null); // the salon whose «خودت توی صفحهٔ سالن» sheet is open
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ bad: false, text: "" });
  const railRef = useRef(null);
  const connected = teams.length > 0;
  const pendingInvites = invites.filter((item) => item.status === PENDING_INVITE);
  const codeUrl = artistId && typeof window !== "undefined" ? `${window.location.origin}/artists/${artistId}` : "";

  const loadWorkplace = useCallback(async () => {
    try {
      const { ok, data } = await getArtistPlace();
      if (ok && data?.workplace) setWorkplace(data.workplace);
    } catch {
      // the switch stays disabled until it loads
    }
  }, []);
  const teamKey = teams.map((team) => team.salonId).join(",");
  useEffect(() => { if (connected) loadWorkplace(); }, [connected, teamKey, loadWorkplace]);

  // While the code is on screen, check for the salon's invite so it shows up as soon as they scan; close the code
  // once a new invite (or a new team) arrives. Counts, not "any", so an artist already on a team can show it too.
  usePolling(() => onChanged?.(), 5000, sheet === "code");
  const arrivals = teams.length + pendingInvites.length;
  const lastArrivals = useRef(arrivals);
  useEffect(() => {
    if (arrivals > lastArrivals.current) setSheet("");
    lastArrivals.current = arrivals;
  }, [arrivals]);

  const cards = [
    ...pendingInvites.map((invite) => ({
      key: `i${invite.id}`,
      kind: "invite",
      invite,
      salonId: Number(invite.salonId),
      name: invite.salonName || "سالن frfro",
      area: invite.salonArea || "",
      avatar: invite.salonAvatar,
      poster: invite.salonPoster,
      posterPosition: invite.salonPosterPosition,
      terms: invite,
      rules: invite.salonRules,
      badge: "دعوت تازه",
      badgeTone: "invite"
    })),
    ...[...teams]
      .sort((a, b) => (Number(b.salonId) === workplace?.current) - (Number(a.salonId) === workplace?.current))
      .map((team) => {
        const salonId = Number(team.salonId);
        const isHere = workplace?.current === salonId;
        const nextHere = workplace?.next && workplace.next.salonId === salonId;
        return {
          key: `t${team.staffId || salonId}`,
          kind: "team",
          salonId,
          name: team.salonName || "سالن",
          area: team.salonArea || "",
          avatar: team.salonAvatar,
          poster: team.salonPoster,
          posterPosition: team.salonPosterPosition,
          terms: team,
          rules: team.salonRules,
          badge: isHere ? "الان اینجا کار می‌کنی" : nextHere ? `${fromLabel(workplace.next.from)} اینجا` : "توی تیمشی",
          badgeTone: isHere ? "here" : nextHere ? "next" : "team"
        };
      })
  ];
  const activeIndex = Math.min(active, Math.max(0, cards.length - 1));
  const card = cards[activeIndex] || null;

  // The card in view follows the swipe (RTL: scrollLeft runs negative in most browsers, so only its size counts).
  function onRailScroll() {
    const rail = railRef.current;
    const first = rail?.firstElementChild;
    if (!rail || !first) return;
    const step = first.getBoundingClientRect().width + 10;
    const index = Math.round(Math.abs(rail.scrollLeft) / step);
    if (index !== activeIndex) { setActive(index); setMenuFor(""); }
  }
  function focusCard(index) {
    setActive(index);
    setMenuFor("");
    const node = railRef.current?.children?.[index];
    node?.scrollIntoView?.({ behavior: "smooth", inline: "center", block: "nearest" });
  }
  // A new order of cards (an invite arrives, a team joins, the workplace moves to the front): the row starts at its first
  // card again. Browsers keep a snapped card in view when cards reorder, which would leave the row on the old one.
  const order = cards.map((item) => item.key).join("|");
  useEffect(() => { setActive(0); railRef.current?.scrollTo?.({ left: 0 }); }, [order]);

  async function accept(invite) {
    const done = await onInviteRespond?.(invite.id, "تایید شد");
    if (done) openSwitch({ salonId: Number(invite.salonId), name: invite.salonName || "سالن", ask: true });
  }

  // A fresh sheet: an older message (a failed cancel, the last switch) does not follow it in.
  function openSwitch(target) {
    setMessage({ bad: false, text: "" });
    setSwitchTo(target);
  }

  async function saveSwitch({ startsOn, moveBookings }) {
    if (!switchTo || saving) return;
    setSaving(true);
    setMessage({ bad: false, text: "" });
    try {
      const { ok, payload } = await saveArtistPlace({ salonId: switchTo.salonId, startsOn, moveBookings });
      if (!ok) { setMessage({ bad: true, text: payload?.error || "عوض نشد؛ دوباره بزن." }); return; }
      const result = payload?.data || {};
      if (result.workplace) setWorkplace(result.workplace);
      const where = switchTo.salonId ? switchTo.name : "جای خودت";
      const moved = Number(result.moved) || 0;
      const kept = Number(result.kept) || 0;
      const parts = [`${fromLabel(startsOn)} مشتری‌هات میان ${where}.`];
      if (moved) parts.push(`${toPersianDigits(moved)} نوبت جابه‌جا شد و به مشتری‌هاش خبر دادیم.`);
      if (kept) parts.push(`${toPersianDigits(kept)} نوبت چون سالن اون ساعت بسته‌ست سر جاش موند.`);
      setMessage({ bad: false, text: parts.join(" ") });
      setSwitchTo(null);
    } catch {
      setMessage({ bad: true, text: "عوض نشد؛ دوباره بزن." });
    } finally {
      setSaving(false);
    }
  }

  async function cancelNext() {
    if (!workplace?.next || saving) return;
    setSaving(true);
    try {
      const { ok, payload } = await saveArtistPlace({ salonId: workplace.savedCurrent, startsOn: workplace.next.from, moveBookings: false });
      if (ok && payload?.data?.workplace) { setWorkplace(payload.data.workplace); setMessage({ bad: false, text: "جابه‌جایی لغو شد." }); }
      else setMessage({ bad: true, text: payload?.error || "لغو نشد؛ دوباره بزن." });
    } catch {
      setMessage({ bad: true, text: "لغو نشد؛ دوباره بزن." });
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (salonId) => (salonId ? workplace?.teams?.find((team) => team.salonId === salonId)?.name || "سالن" : "جای خودت");
  const info = card?.kind === "team" ? workplace?.teams?.find((team) => team.salonId === card.salonId) : null;

  return (
    <section className="collabBoard clwBoard" aria-label="همکاری با سالن">
      {connected && workplace ? (
        <div className="clwNow" role="status">
          <span className="clwNowDot" aria-hidden="true" />
          <span>مشتری‌هات الان میان <b>{nameOf(workplace.current)}</b></span>
          {workplace.next ? (
            <span className="clwNowNext">
              {fromLabel(workplace.next.from)}: {nameOf(workplace.next.salonId)}
              <button type="button" disabled={saving} onClick={cancelNext}>لغو</button>
            </span>
          ) : null}
        </div>
      ) : null}

      {cards.length ? (
        <>
          <div className={`clwRail${cards.length === 1 ? " is-single" : ""}`} ref={railRef} onScroll={onRailScroll}>
            {cards.map((item, index) => (
              <WalletCard
                key={item.key}
                card={item}
                active={index === activeIndex}
                menuOpen={menuFor === item.key}
                onMenu={() => setMenuFor((current) => (current === item.key ? "" : item.key))}
                onFocus={() => focusCard(index)}
                leaveBusy={String(teamBusyId) === String(item.salonId)}
                onLeave={() => { setMenuFor(""); onLeaveTeam?.(item.salonId); }}
              />
            ))}
          </div>
          {cards.length > 1 ? (
            <div className="clwDots" role="tablist" aria-label="سالن‌ها">
              {cards.map((item, index) => (
                <button
                  type="button"
                  key={item.key}
                  role="tab"
                  aria-selected={index === activeIndex}
                  aria-label={item.name}
                  className={index === activeIndex ? "is-on" : ""}
                  onClick={() => focusCard(index)}
                />
              ))}
            </div>
          ) : null}

          {card ? (
            <div className="clwPanel" key={card.key}>
              {card.kind === "invite" ? (
                <>
                  <p className="clwInviteLead">{card.name} دعوتت کرده توی تیمش کار کنی.</p>
                  <TermsChips days={card.terms.days} from={card.terms.from} to={card.terms.to} share={card.terms.share} capacity={card.terms.capacity} />
                  <SalonRulesNote rules={card.rules} open />
                  {card.rules ? <p className="salonRulesAgree">قبول کنی، یعنی قوانین سالن رو هم قبول داری.</p> : null}
                  <div className="clwSheetActions">
                    <button type="button" className="clwBtn is-ghost" disabled={String(inviteRespondBusyId) === String(card.invite.id)} onClick={() => onInviteRespond?.(card.invite.id, "رد شد")}>
                      <X size={15} aria-hidden="true" />
                      رد
                    </button>
                    <button type="button" className="clwBtn is-primary" disabled={String(inviteRespondBusyId) === String(card.invite.id)} onClick={() => accept(card.invite)}>
                      <Check size={15} aria-hidden="true" />
                      قبول
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <WhereRow
                    card={card}
                    workplace={workplace}
                    onTurnOn={() => openSwitch({ salonId: card.salonId, name: card.name })}
                    onTurnOff={() => openSwitch({ salonId: null, name: "جای خودت" })}
                  />
                  {info?.weekCount ? (
                    <div className="clwFoot">
                      <span className="clwCount">{toPersianDigits(info.weekCount)} نوبت این هفته اینجاست</span>
                    </div>
                  ) : null}
                  <TermsFacts terms={card.terms} />
                  <ArtistSalonDetails
                    card={card}
                    team={card.terms}
                    leaveBusy={String(teamBusyId) === String(card.salonId)}
                    onLeave={() => onLeaveTeam?.(card.salonId)}
                    onOpenSelf={() => setSelfFor(card.terms)}
                  />
                </>
              )}
            </div>
          ) : null}
          {message.text ? <p className={`clwMsg${message.bad ? " is-bad" : ""}`} role="status">{message.text}</p> : null}
        </>
      ) : null}

      {proposals.length ? (
        <section className="cwCard clwProposals" aria-label="پیشنهادهای من">
          <div className="cwHead"><b>پیشنهادهای من</b></div>
          {proposals.map((item) => (
            <div className="cwPostRow" key={item.id}>
              {item.salonAvatar ? <img src={item.salonAvatar} alt="" /> : <i aria-hidden="true" />}
              <span>
                <b>منتظر جواب {item.salonName || "سالن"}</b>
                <small>وقتی سالن جواب بده، بهت خبر می‌دیم.</small>
              </span>
              <button type="button" className="cwEdit" onClick={() => onCancelProposal?.(item.id)}>لغو</button>
            </div>
          ))}
        </section>
      ) : null}

      <LeaveCard onNotice={onNotice} />

      {connected ? <p className="clwAddLead">یه سالن دیگه هم اضافه کن</p> : null}
      <div className="cnScanRow">
        <button type="button" className="cnScanBtn" onClick={() => setSheet("scan")}>
          <span aria-hidden="true"><ScanLine size={20} /></span>
          <span><b>اسکن کن</b><small>کد سالن رو اسکن کن</small></span>
        </button>
        <button type="button" className="cnScanBtn" disabled={!codeUrl} onClick={() => setSheet("code")}>
          <span aria-hidden="true"><QrCode size={20} /></span>
          <span><b>کد من</b><small>کدت رو به سالن نشون بده</small></span>
        </button>
      </div>
      {!cards.length ? <Mascot pose="team" size={190} className="clConnMascot" /> : null}

      <ArtistSelfSheet open={Boolean(selfFor)} team={selfFor} artistName={artistName} onClose={() => setSelfFor(null)} onChanged={() => onChanged?.()} />
      <SwitchSheet target={switchTo} ask={Boolean(switchTo?.ask)} busy={saving} error={switchTo && message.bad ? message.text : ""} onSave={saveSwitch} onClose={() => { setSwitchTo(null); setMessage({ bad: false, text: "" }); }} />

      {sheet === "scan" ? (
        <ScanFlow viewerType="artist" onChanged={() => onChanged?.()} onClose={() => setSheet("")} />
      ) : null}
      <ProfileQrCodeSheet
        open={sheet === "code"}
        url={codeUrl}
        name={artistName || "کد من"}
        hint="سالن‌دار این کد رو اسکن کنه؛ دعوتش همین‌جا برات میاد."
        onOpenChange={(open) => setSheet(open ? "code" : "")}
      />
    </section>
  );
}
