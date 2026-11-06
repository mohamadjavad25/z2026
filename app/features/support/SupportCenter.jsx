"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bug, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Ellipsis, Flag, MessageSquareWarning, Star, UserRoundCog, X } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { SupportIcon } from "./SupportIcon";
import { notifySupportRead } from "./supportEvents";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { MessageAttachments } from "./Attachments";
import { Composer } from "./Composer";
import { SkeletonList } from "../../components/Skeleton";
import { FEEDBACK_THANKS } from "../../shared/lib/feedback";
import { FeedbackForm } from "./FeedbackForm";

// value, label, icon, one line that says when to pick it, and the first line of the chat (shown here, never stored).
const TOPICS = [
  ["question", "سؤال", CircleHelp, "یه چیزی می‌خوام بدونم", "سلام! سؤالت چیه؟"],
  ["bug", "مشکل فنی", Bug, "یه چیزی کار نمی‌کنه", "سلام! داشتی چی کار می‌کردی و چی شد؟ اگه راحت‌تری، عکس صفحه رو بفرست."],
  ["account", "مشکل حساب", UserRoundCog, "ورود، شماره، اشتراک", "سلام! مشکل حسابت چیه؟"],
  ["complaint", "شکایت", MessageSquareWarning, "از کسی یا چیزی راضی نبودم", "سلام! ماجرا چی بود؟ اگه از یه سالن یا آرتیسته، اسمش رو هم بگو."],
  ["feedback", "نظر و پیشنهاد", Star, "به یه بخش امتیاز بده و نظرت رو بگو", ""],
  ["other", "سایر", Ellipsis, "هیچ‌کدوم از اینا", "سلام! بگو چی شده."]
];
const CATEGORY_LABEL = Object.fromEntries(TOPICS.map(([value, label]) => [value, label]));
const REASON_LABEL = { spam: "اسپم یا تبلیغ", inappropriate: "محتوای نامناسب", fake: "جعلی یا گمراه‌کننده", copyright: "کپی از کار دیگران", other: "سایر" };

const digits = (value) => String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const clock = (value) => digits(new Intl.DateTimeFormat("fa-IR-u-nu-latn", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(value)));
const dayName = (value) => new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", timeZone: "Asia/Tehran" }).format(new Date(value));
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

function ago(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return "همین الان";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

/** What the person should see as the state of their ticket, in plain words. */
function stateOf(ticket) {
  if (ticket.status === "closed") return { key: "closed", label: "بسته شد" };
  if (ticket.last_actor === "admin") return { key: "answered", label: "جواب داده" };
  return { key: "waiting", label: "منتظر جواب" };
}

function titleOf(ticket) {
  if (ticket.kind === "report") return `گزارش ${ticket.target_type === "user" ? "حساب" : "نمونه‌کار"}${ticket.subject ? `: ${ticket.subject}` : ""}`;
  return ticket.subject || (ticket.from_admin ? "پیام از پشتیبانی" : CATEGORY_LABEL[ticket.category] || "پیام به پشتیبانی");
}

function StatePill({ ticket }) {
  const state = stateOf(ticket);
  return <span className={`scState is-${state.key}`}><i aria-hidden="true" />{state.label}</span>;
}

function TicketList({ onOpen, onNew }) {
  const [tickets, setTickets] = useState(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    const { ok, payload } = await apiFetch("/api/support/tickets").catch(() => ({ ok: false }));
    if (ok) {
      setTickets(payload.data.tickets);
      setFailed(false);
    } else setFailed(true);
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="scBody">
      <section className="scAsk" aria-labelledby="scAskTitle">
        <div className="scAskHead">
          <h4 id="scAskTitle">چه کمکی ازمون برمیاد؟</h4>
          <p>موضوع رو انتخاب کن؛ جوابش همین‌جا میاد.</p>
        </div>
        <div className="scTopics">
          {TOPICS.map(([value, label, Icon, hint]) => (
            <button key={value} type="button" className="scTopic" onClick={() => onNew(value)}>
              <span className="scTopicIcon"><Icon size={20} aria-hidden="true" /></span>
              <span className="scTopicText"><b>{label}</b><small>{hint}</small></span>
              <ChevronLeft className="scTopicGo" size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {failed ? (
        <div className="scError scRetry" role="alert">
          <span>نیومد؛ اینترنتت رو یه نگاه بنداز.</span>
          <button type="button" onClick={load}>دوباره</button>
        </div>
      ) : null}

      <section className="scMine" aria-labelledby="scMineTitle">
        <div className="scMineHead">
          <h4 id="scMineTitle">گفتگوهای من</h4>
          {tickets?.length ? <span className="scCount">{digits(tickets.length)}</span> : null}
        </div>
        {tickets === null && !failed ? <SkeletonList rows={2} variant="row" label="در حال بارگذاری گفتگوها" /> : null}
        {tickets && !tickets.length ? (
          <div className="scEmpty">
            <span className="scEmptyIcon"><SupportIcon size={30} /></span>
            <b>هنوز پیامی ندادی</b>
            <p>هر چی بپرسی، جوابش همین‌جا می‌مونه.</p>
          </div>
        ) : null}
        {tickets?.length ? (
          <ul className="scList">
            {tickets.map((ticket) => {
              const state = stateOf(ticket);
              return (
                <li key={ticket.id}>
                  <button type="button" className={`is-${state.key}${ticket.unread ? " is-unread" : ""}`} onClick={() => onOpen(ticket.id)}>
                    <span className={`scKind is-${ticket.kind}`}>{ticket.kind === "report" ? <Flag size={16} aria-hidden="true" /> : <SupportIcon size={18} />}</span>
                    <span className="scItemBody">
                      <span className="scItemTop">
                        <b>{titleOf(ticket)}</b>
                        <time dateTime={ticket.last_message_at}>{ago(ticket.last_message_at)}</time>
                      </span>
                      <small>{ticket.last_body || (ticket.kind === "report" ? REASON_LABEL[ticket.category] : "")}</small>
                      <StatePill ticket={ticket} />
                    </span>
                    {ticket.unread ? <i className="scDot" aria-label="جواب تازه" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

/**
 * One conversation. With `draft` ({ category, subject }) it opens as an empty chat on the picked topic: nothing exists
 * on the server until the first message goes out, so backing out leaves no empty conversation behind.
 */
function Thread({ id: startId = null, draft = null }) {
  const [id, setId] = useState(startId);
  const [data, setData] = useState(startId ? null : { ticket: { kind: "support", status: "open", category: draft?.category, subject: draft?.subject }, messages: [] });
  // Messages on their way: shown at once (with a clock) so sending a picture or a voice note never feels stuck.
  const [pending, setPending] = useState([]);
  const endRef = useRef(null);

  const load = useCallback(async (ticketId, silent = false, onLoaded) => {
    const { ok, payload = {} } = await apiFetch(`/api/support/tickets/${ticketId}`).catch(() => ({ ok: false }));
    if (ok) {
      setData(payload.data);
      onLoaded?.(); // same update, so a sent message is never on screen twice
    } else if (!silent) setData({ error: payload.error || "نیومد؛ دوباره بزن." });
    notifySupportRead();
  }, []);
  useEffect(() => {
    if (!id) return undefined;
    load(id);
    const timer = setInterval(() => load(id, true), 15_000);
    return () => clearInterval(timer);
  }, [id, load]);
  const count = (data?.messages?.length || 0) + pending.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [count]);

  async function send({ message, attachments }) {
    const key = `p${Date.now()}`;
    const preview = attachments.map((item) => (item.kind === "image" ? { kind: "image", src: item.data } : { kind: "voice", durationMs: item.durationMs, pending: true }));
    setPending((prev) => [...prev, { key, body: message, attachments: preview }]);
    let result;
    try {
      result = id
        ? await apiFetch(`/api/support/tickets/${id}`, { method: "POST", body: JSON.stringify({ message, attachments }) })
        : await apiFetch("/api/support", { method: "POST", body: JSON.stringify({ category: draft?.category, subject: draft?.subject, message, attachments }) });
    } catch {
      result = { ok: false, payload: { error: "اینترنتت وصل نیست؛ یه نگاه بنداز و دوباره بزن." } };
    }
    const clearPending = () => setPending((prev) => prev.filter((item) => item.key !== key));
    if (result.ok) {
      const ticketId = id ?? result.payload.data.id;
      await load(ticketId, true, clearPending);
      setId(ticketId);
    }
    clearPending();
    if (!result.ok) {
      setData((prev) => ({ ...prev, sendError: result.payload.error || "نرفت؛ دوباره بزن." }));
      return false;
    }
    setData((prev) => ({ ...prev, sendError: "" }));
    return true;
  }

  if (!data) return <div className="scBody"><SkeletonList rows={3} variant="row" label="در حال بارگذاری گفتگو" /></div>;
  if (data.error) return <div className="scBody"><p className="scError" role="alert">{data.error}</p></div>;
  const { ticket, messages } = data;
  const closed = ticket.status === "closed";
  return (
    <>
      <div className="scThread" aria-live="polite">
        <div className="scThreadHead">
          <b>{titleOf(ticket)}</b>
          {id ? <StatePill ticket={ticket} /> : null}
        </div>
        {draft ? (
          <div className="scGroup">
            <div className="scMsg is-admin">
              <small className="scWho"><SupportIcon size={13} /> پشتیبانی فرفرو</small>
              <p>{(TOPICS.find(([value]) => value === draft.category) || TOPICS[0])[4]}</p>
            </div>
          </div>
        ) : null}
        {ticket.category === "feedback" ? (
          <>
            <div className="scFeedback">
              {ticket.feedback_stars ? <span className="fbStarsRow" aria-label={`${ticket.feedback_stars} ستاره`}>{"★".repeat(ticket.feedback_stars)}{"☆".repeat(5 - ticket.feedback_stars)}</span> : null}
              <span>{ticket.feedback_kind}{ticket.feedback_section ? ` · ${ticket.feedback_section}` : ""}</span>
            </div>
            <p className="scInfo">{FEEDBACK_THANKS}</p>
          </>
        ) : null}
        {ticket.kind === "report" ? <p className="scInfo">گزارشت رسید و بررسیش می‌کنیم. هر خبری بود همین‌جا می‌نویسیم.{ticket.category ? ` (دلیل: ${REASON_LABEL[ticket.category] || ticket.category})` : ""}</p> : null}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = index === 0 || !sameDay(previous.created_at, message.created_at);
          const grouped = !newDay && previous.author === message.author;
          const media = message.attachments?.length ? (message.attachments.some((item) => item.kind === "voice") ? " has-voice" : " has-images") : "";
          return (
            <div key={message.id} className={grouped ? "scGroup is-grouped" : "scGroup"}>
              {newDay ? <p className="scDay">{dayName(message.created_at)}</p> : null}
              <div className={`scMsg is-${message.author}${media}`}>
                {message.author === "admin" && !grouped ? <small className="scWho"><SupportIcon size={13} /> پشتیبانی فرفرو</small> : null}
                <MessageAttachments items={message.attachments} />
                {message.body ? <p>{message.body}</p> : null}
                <time dateTime={message.created_at}>
                  {clock(message.created_at)}
                  {message.author === "user" ? <Check size={12} aria-label="فرستاده شد" /> : null}
                </time>
              </div>
            </div>
          );
        })}
        {pending.map((item) => (
          <div key={item.key} className="scGroup">
            <div className={`scMsg is-user is-pending${item.attachments.length ? " has-images" : ""}`}>
              {item.attachments.some((file) => file.kind === "voice") ? <p>🎤 پیام صوتی</p> : <MessageAttachments items={item.attachments} />}
              {item.body ? <p>{item.body}</p> : null}
              <time><Clock3 size={12} aria-hidden="true" /> داره می‌ره</time>
            </div>
          </div>
        ))}
        {!messages.length && !draft ? <p className="scMuted">هنوز پیامی اینجا نیست.</p> : null}
        {closed ? <p className="scInfo">این گفتگو بسته شده؛ پیام بدی دوباره باز می‌شه.</p> : null}
        <div ref={endRef} />
      </div>
      {data.sendError ? <p className="scError scThreadError" role="alert">{data.sendError}</p> : null}
      <Composer placeholder={closed ? "پیام بده تا دوباره باز بشه…" : "پیامت رو بنویس…"} onSend={send} />
    </>
  );
}

/**
 * The whole support experience in one sheet: my conversations and one conversation. Picking a topic goes straight into
 * a chat. `initial` can jump to a conversation ({ ticketId }) or a new chat ({ view: "new", category?, subject? }, e.g.
 * a complaint already titled with a salon's name).
 */
export function SupportCenter({ initial = {}, role = "client", onClose: closeSheet }) {
  // Opened by the come-back nudge ({ nudge: true }): sending the form answers it, closing without sending puts it off.
  const answered = useRef(false);
  const onClose = useCallback(() => {
    if (initial.nudge && !answered.current) apiFetch("/api/welcome-survey", { method: "POST", body: JSON.stringify({ action: "later" }) }).catch(() => null);
    closeSheet();
  }, [initial.nudge, closeSheet]);
  useBackHandler(true, onClose);
  const [view, setView] = useState(initial.view === "feedback" ? { name: "feedback" } : initial.ticketId ? { name: "thread", id: initial.ticketId } : initial.view === "new" ? { name: "thread", draft: { category: initial.category || "question", subject: initial.subject } } : { name: "list" });
  const sheetRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    sheetRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);
  if (typeof document === "undefined") return null;

  const inList = view.name === "list";
  const title = view.name === "thread" ? "گفتگو" : view.name === "feedback" ? "نظر و پیشنهاد" : "پشتیبانی";
  return createPortal(
    <div className="scOverlay" onClick={onClose}>
      <div className="scSheet" role="dialog" aria-modal="true" aria-label="پشتیبانی" tabIndex={-1} ref={sheetRef} onClick={(event) => event.stopPropagation()}>
        <header className="scHead">
          {inList ? (
            <span className="scHeadIcon"><SupportIcon size={22} /></span>
          ) : (
            <button type="button" className="scIconBtn" onClick={() => setView({ name: "list" })} aria-label="بازگشت به فهرست">
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          )}
          <h3>{title}</h3>
          <button type="button" className="scIconBtn" onClick={onClose} aria-label="بستن پشتیبانی"><X size={19} aria-hidden="true" /></button>
        </header>
        {view.name === "list" ? <TicketList onOpen={(id) => setView({ name: "thread", id })} onNew={(category) => setView(category === "feedback" ? { name: "feedback" } : { name: "thread", draft: { category } })} /> : null}
        {view.name === "feedback" ? <FeedbackForm role={role} onSent={(id) => { answered.current = true; if (initial.nudge) apiFetch("/api/welcome-survey", { method: "POST", body: JSON.stringify({ action: "done" }) }).catch(() => null); setView({ name: "thread", id }); }} /> : null}
        {view.name === "thread" ? <Thread key={view.id ?? "new"} id={view.id} draft={view.draft} /> : null}
      </div>
    </div>,
    document.body
  );
}
