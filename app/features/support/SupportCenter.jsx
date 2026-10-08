"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Flag, MessageSquarePlus, Send, X } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { SupportIcon } from "./SupportIcon";
import { notifySupportRead } from "./supportEvents";

const CATEGORIES = [
  ["question", "سؤال"],
  ["bug", "مشکل فنی"],
  ["account", "مشکل حساب"],
  ["complaint", "شکایت"],
  ["other", "سایر"]
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
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
  return <span className={`scState is-${state.key}`}>{state.label}</span>;
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
      <button type="button" className="scPrimary" onClick={onNew}>
        <MessageSquarePlus size={18} aria-hidden="true" /> پیام جدید به پشتیبانی
      </button>
      {failed ? <p className="scError" role="alert">بارگذاری نشد. اینترنتت را بررسی کن.</p> : null}
      {tickets === null && !failed ? <p className="scMuted">در حال بارگذاری…</p> : null}
      {tickets && !tickets.length ? (
        <div className="scEmpty">
          <span className="scEmptyIcon"><SupportIcon size={34} /></span>
          <b>هنوز پیامی نداری</b>
          <p>سؤال یا مشکلی داری؟ همین‌جا بنویس. جواب را هم همین‌جا می‌بینی.</p>
        </div>
      ) : null}
      {tickets?.length ? (
        <ul className="scList">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button type="button" className={ticket.unread ? "is-unread" : ""} onClick={() => onOpen(ticket.id)}>
                <span className={`scKind is-${ticket.kind}`}>{ticket.kind === "report" ? <Flag size={16} aria-hidden="true" /> : <SupportIcon size={18} />}</span>
                <span className="scItemBody">
                  <b>{titleOf(ticket)}</b>
                  <small>{ticket.last_body || (ticket.kind === "report" ? REASON_LABEL[ticket.category] : "")}</small>
                </span>
                <span className="scItemMeta">
                  <time dateTime={ticket.last_message_at}>{ago(ticket.last_message_at)}</time>
                  <StatePill ticket={ticket} />
                </span>
                {ticket.unread ? <i className="scDot" aria-label="پاسخ جدید" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Thread({ id }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const count = data?.messages?.length || 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  async function send(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    const { ok, payload } = await apiFetch(`/api/support/tickets/${id}`, { method: "POST", body: JSON.stringify({ message }) });
    setBusy(false);
    if (!ok) return setError(payload.error || "ارسال نشد. دوباره امتحان کن.");
    setText("");
    await load(true);
  }

  if (!data) return <div className="scBody"><p className="scMuted">در حال بارگذاری…</p></div>;
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
        {messages.map((message, index) => (
          <div key={message.id}>
            {index === 0 || !sameDay(messages[index - 1].created_at, message.created_at) ? <p className="scDay">{dayName(message.created_at)}</p> : null}
            <div className={`scMsg is-${message.author}`}>
              {message.author === "admin" ? <small className="scWho">پشتیبانی فرفرو</small> : null}
              <p>{message.body}</p>
              <time dateTime={message.created_at}>{clock(message.created_at)}</time>
            </div>
          </div>
        ))}
        {!messages.length ? <p className="scMuted">هنوز پیامی در این گفتگو نیست.</p> : null}
        {closed ? <p className="scInfo">این گفتگو بسته شده. اگر پیام بدهی دوباره باز می‌شود.</p> : null}
        <div ref={endRef} />
      </div>
      <form className="scComposer" onSubmit={send}>
        {error ? <p className="scError" role="alert">{error}</p> : null}
        <div className="scComposerRow">
          <textarea
            rows={1}
            value={text}
            maxLength={2000}
            placeholder={closed ? "پیام بده تا دوباره باز شود…" : "پیامت را بنویس…"}
            aria-label="پیام"
            onChange={(event) => {
              setText(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 130)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) send(event);
            }}
          />
          <button type="submit" className="scSend" disabled={busy || !text.trim()} aria-label="ارسال">
            <Send size={19} aria-hidden="true" />
          </button>
        </div>
      </form>
    </>
  );
}

function NewTicket({ onCreated }) {
  const [category, setCategory] = useState("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { ok, payload } = await apiFetch("/api/support", { method: "POST", body: JSON.stringify({ category, subject, message }) });
    setBusy(false);
    if (ok) onCreated(payload.data.id);
    else setError(payload.error || "ارسال نشد. دوباره امتحان کن.");
  }

  return (
    <form className="scBody scForm" onSubmit={submit}>
      <div className="scChips" role="radiogroup" aria-label="موضوع پیام">
        {CATEGORIES.map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={category === value} className={category === value ? "is-on" : ""} onClick={() => setCategory(value)}>{label}</button>
        ))}
      </div>
      <label className="scField">
        <span>عنوان (اختیاری)</span>
        <input type="text" value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} />
      </label>
      <label className="scField">
        <span>پیامت</span>
        <textarea rows={6} value={message} maxLength={2000} required minLength={10} onChange={(event) => setMessage(event.target.value)} placeholder="مشکل یا سؤالت را بنویس…" />
      </label>
      {error ? <p className="scError" role="alert">{error}</p> : null}
      <button type="submit" className="scPrimary" disabled={busy || message.trim().length < 10}>{busy ? "در حال ارسال…" : "ارسال پیام"}</button>
    </form>
  );
}

/**
 * The whole support experience in one sheet: my conversations, one conversation (read replies, keep writing),
 * and a new message. `initial` can jump straight to a conversation ({ ticketId }) or the new-message form ({ view: "new" }).
 */
export function SupportCenter({ initial = {}, onClose }) {
  const [view, setView] = useState(initial.ticketId ? { name: "thread", id: initial.ticketId } : initial.view === "new" ? { name: "new" } : { name: "list" });
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
        {view.name === "list" ? <TicketList onOpen={(id) => setView({ name: "thread", id })} onNew={() => setView({ name: "new" })} /> : null}
        {view.name === "thread" ? <Thread key={view.id} id={view.id} /> : null}
        {view.name === "new" ? <NewTicket onCreated={(id) => setView({ name: "thread", id })} /> : null}
      </div>
    </div>,
    document.body
  );
}
