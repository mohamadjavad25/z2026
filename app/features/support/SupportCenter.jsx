"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bug, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Ellipsis, Flag, MessageSquareWarning, UserRoundCog, X } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { SupportIcon } from "./SupportIcon";
import { notifySupportRead } from "./supportEvents";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { MessageAttachments } from "./Attachments";
import { AttachmentField, Composer } from "./Composer";
import { Spinner } from "../../components/Spinner";
import { SkeletonList } from "../../components/Skeleton";

// value, label, icon, one line that says when to pick it, and what to write in the box.
const TOPICS = [
  ["question", "سؤال", CircleHelp, "می‌خواهم چیزی را بدانم", "سؤالت را بنویس…"],
  ["bug", "مشکل فنی", Bug, "چیزی کار نمی‌کند", "چه کار می‌کردی و چه شد؟ اگر راحت‌تری عکس صفحه بفرست."],
  ["account", "مشکل حساب", UserRoundCog, "ورود، شماره، اشتراک", "مشکل حسابت را بنویس…"],
  ["complaint", "شکایت", MessageSquareWarning, "از کسی یا چیزی راضی نبودم", "ماجرا را بنویس؛ اگر شکایت از یک سالن یا آرتیست است، اسمش را هم بگو."],
  ["other", "سایر", Ellipsis, "هیچ‌کدام از این‌ها", "هر چه می‌خواهی بنویس…"]
];
const CATEGORY_LABEL = Object.fromEntries(TOPICS.map(([value, label]) => [value, label]));
const MIN_MESSAGE = 10;
const REASON_LABEL = { spam: "اسپم یا تبلیغ", inappropriate: "محتوای نامناسب", fake: "جعلی یا گمراه‌کننده", copyright: "کپی از دیگران", other: "سایر" };

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
  if (ticket.last_actor === "admin") return { key: "answered", label: "پاسخ داده شد" };
  return { key: "waiting", label: "در انتظار پاسخ" };
}

function titleOf(ticket) {
  if (ticket.kind === "report") return `گزارش ${ticket.target_type === "user" ? "حساب" : "پست"}${ticket.subject ? `: ${ticket.subject}` : ""}`;
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
    const { ok, payload } = await apiFetch("/api/support/tickets");
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
          <h4 id="scAskTitle">چه کمکی می‌خواهی؟</h4>
          <p>موضوع را انتخاب کن، جواب را همین‌جا می‌بینی.</p>
        </div>
        <div className="scTopics">
          {TOPICS.map(([value, label, Icon, hint]) => (
            <button key={value} type="button" className={`scTopic${value === "other" ? " is-wide" : ""}`} onClick={() => onNew(value)}>
              <span className="scTopicIcon"><Icon size={20} aria-hidden="true" /></span>
              <span className="scTopicText"><b>{label}</b><small>{hint}</small></span>
              <ChevronLeft className="scTopicGo" size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {failed ? (
        <div className="scError scRetry" role="alert">
          <span>بارگذاری نشد. اینترنتت را بررسی کن.</span>
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
            <b>هنوز پیامی نداری</b>
            <p>وقتی به پشتیبانی پیام بدهی، گفتگو و جوابش اینجا می‌ماند.</p>
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
                    {ticket.unread ? <i className="scDot" aria-label="پاسخ جدید" /> : null}
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

function Thread({ id }) {
  const [data, setData] = useState(null);
  // Messages on their way: shown at once (with a clock) so sending a picture or a voice note never feels stuck.
  const [pending, setPending] = useState([]);
  const endRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    const { ok, payload } = await apiFetch(`/api/support/tickets/${id}`);
    if (ok) setData(payload.data);
    else if (!silent) setData({ error: payload.error || "بارگذاری نشد." });
    notifySupportRead();
  }, [id]);
  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 15_000);
    return () => clearInterval(timer);
  }, [load]);
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
      result = await apiFetch(`/api/support/tickets/${id}`, { method: "POST", body: JSON.stringify({ message, attachments }) });
    } catch {
      result = { ok: false, payload: { error: "اتصال برقرار نشد. اینترنتت را بررسی کن." } };
    }
    if (result.ok) await load(true);
    setPending((prev) => prev.filter((item) => item.key !== key));
    if (!result.ok) {
      setData((prev) => ({ ...prev, sendError: result.payload.error || "ارسال نشد. دوباره امتحان کن." }));
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
          <StatePill ticket={ticket} />
        </div>
        {ticket.kind === "report" ? <p className="scInfo">گزارش تو ثبت شد و بررسی می‌شود. هر خبری باشد همین‌جا می‌نویسیم.{ticket.category ? ` (دلیل: ${REASON_LABEL[ticket.category] || ticket.category})` : ""}</p> : null}
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
              <time><Clock3 size={12} aria-hidden="true" /> در حال ارسال</time>
            </div>
          </div>
        ))}
        {!messages.length ? <p className="scMuted">هنوز پیامی در این گفتگو نیست.</p> : null}
        {closed ? <p className="scInfo">این گفتگو بسته شده. اگر پیام بدهی دوباره باز می‌شود.</p> : null}
        <div ref={endRef} />
      </div>
      {data.sendError ? <p className="scError scThreadError" role="alert">{data.sendError}</p> : null}
      <Composer placeholder={closed ? "پیام بده تا دوباره باز شود…" : "پیامت را بنویس…"} onSend={send} />
    </>
  );
}

function NewTicket({ initialCategory = "question", initialSubject = "", onCreated }) {
  const [category, setCategory] = useState(initialCategory);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const topic = TOPICS.find(([value]) => value === category) || TOPICS[0];
  const length = message.trim().length;
  const ready = attachments.length > 0 || length >= MIN_MESSAGE;

  async function submit(event) {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    const { ok, payload } = await apiFetch("/api/support", { method: "POST", body: JSON.stringify({ category, subject, message, attachments }) }).catch(() => ({ ok: false, payload: { error: "اتصال برقرار نشد. اینترنتت را بررسی کن." } }));
    setBusy(false);
    if (ok) onCreated(payload.data.id);
    else setError(payload.error || "ارسال نشد. دوباره امتحان کن.");
  }

  return (
    <form className="scForm" onSubmit={submit}>
      <div className="scBody">
        <fieldset className="scFieldset">
          <legend>موضوع</legend>
          <div className="scPicks" role="radiogroup" aria-label="موضوع پیام">
            {TOPICS.map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={category === value} className={`scPick${category === value ? " is-on" : ""}${value === "other" ? " is-wide" : ""}`} onClick={() => setCategory(value)}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="scField">
          <span>پیامت</span>
          <textarea rows={6} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder={topic[4]} />
          <em className={`scCounter${length >= MIN_MESSAGE ? " is-ok" : ""}`} aria-live="polite">
            {attachments.length ? "عکس یا صدا هم کافی است" : length >= MIN_MESSAGE ? <><Check size={13} aria-hidden="true" /> آماده ارسال</> : `حداقل ${digits(MIN_MESSAGE)} حرف بنویس (${digits(length)} از ${digits(MIN_MESSAGE)})`}
          </em>
        </label>
        <AttachmentField value={attachments} onChange={setAttachments} />
        <label className="scField">
          <span>عنوان <small>(اختیاری)</small></span>
          <input type="text" value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} placeholder="مثلاً: نوبتم ثبت نشد" />
        </label>
      </div>
      <footer className="scFoot">
        {error ? <p className="scError" role="alert">{error}</p> : null}
        <button type="submit" className="scPrimary" disabled={busy || !ready} aria-busy={busy || undefined}>
          {busy ? <><Spinner size={18} current /> در حال ارسال…</> : "ارسال پیام"}
        </button>
      </footer>
    </form>
  );
}

/**
 * The whole support experience in one sheet: my conversations, one conversation (read replies, keep writing),
 * and a new message. `initial` can jump straight to a conversation ({ ticketId }) or the new-message form
 * ({ view: "new", category?, subject? }, e.g. a complaint already titled with a salon's name).
 */
export function SupportCenter({ initial = {}, onClose }) {
  useBackHandler(true, onClose);
  const [view, setView] = useState(initial.ticketId ? { name: "thread", id: initial.ticketId } : initial.view === "new" ? { name: "new", category: initial.category, subject: initial.subject } : { name: "list" });
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
  const title = view.name === "new" ? "پیام جدید" : view.name === "thread" ? "گفتگو" : "پشتیبانی";
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
        {view.name === "list" ? <TicketList onOpen={(id) => setView({ name: "thread", id })} onNew={(category) => setView({ name: "new", category })} /> : null}
        {view.name === "thread" ? <Thread key={view.id} id={view.id} /> : null}
        {view.name === "new" ? <NewTicket initialCategory={view.category} initialSubject={view.subject} onCreated={(id) => setView({ name: "thread", id })} /> : null}
      </div>
    </div>,
    document.body
  );
}
