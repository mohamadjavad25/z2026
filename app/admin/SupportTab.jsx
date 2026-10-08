"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, MessageSquare, Phone, Send } from "lucide-react";
import { apiFetch } from "../shared/api/client";
import { Button, Chip, Field } from "../components/ui";
import { CATEGORY_LABEL, PAGE, REASON_LABEL, RESOLUTION_LABEL, STATUS_LABEL, ago, fmtDate, num } from "./format";
import { PageHead } from "./PageHead";
import { SplitView } from "./SplitView";
import { tabInfo } from "./nav";

const labelOf = (ticket) => (ticket.kind === "report" ? REASON_LABEL[ticket.category] : CATEGORY_LABEL[ticket.category]) || ticket.category;
const clock = (value) => new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(value));

/** Plain words about whose turn it is: the thing an admin actually wants to know at a glance. */
function turnOf(ticket) {
  if (ticket.status === "closed") return { key: "closed", label: "بسته" };
  return ticket.last_actor === "user" ? { key: "you", label: "منتظر پاسخ تو" } : { key: "them", label: "منتظر کاربر" };
}

function TurnPill({ ticket }) {
  const turn = turnOf(ticket);
  return <span className={`admPill admTurn is-${turn.key}`}>{turn.label}</span>;
}

/** One ticket as a conversation: read it, answer the user, and handle what was reported. */
function TicketDetail({ id, onChanged, onGo }) {
  const [found, setFound] = useState(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    const { ok, payload } = await apiFetch(`/api/admin/support/${id}`);
    if (ok) {
      setFound(payload.data);
      setNote(payload.data.ticket.admin_note || "");
    } else setFound({ error: payload.error || "بارگذاری نشد." });
  }, [id]);
  useEffect(() => {
    setFound(null);
    setReply("");
    setMessage("");
    load();
  }, [load]);
  const count = found?.messages?.length || 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  async function send(body, done, after) {
    setBusy(true);
    setMessage("");
    const { ok, payload } = await apiFetch(`/api/admin/support/${id}`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    setMessage(ok ? done : payload.error || "انجام نشد.");
    if (ok) {
      after?.();
      await load();
      onChanged();
    }
  }

  if (!found) return <p className="admMuted">در حال بارگذاری…</p>;
  if (found.error) return <p className="admError" role="alert">{found.error}</p>;
  const { ticket, messages, target } = found;
  const isReport = ticket.kind === "report";
  const phone = ticket.contact_phone || ticket.user_phone;
  const closed = ticket.status === "closed";
  const canReply = Boolean(ticket.user_id);
  return (
    <div className="admDetail admTicket">
      <header className="admDetailHead">
        <span className={`admTicketIcon is-${ticket.kind}`}>{isReport ? <Flag size={18} aria-hidden="true" /> : <MessageSquare size={18} aria-hidden="true" />}</span>
        <div>
          <h2>{ticket.subject || (isReport ? "گزارش" : "پیام")}</h2>
          <p className="admMuted">{labelOf(ticket)} • {fmtDate(ticket.created_at)}</p>
        </div>
        <TurnPill ticket={ticket} />
      </header>
      {message ? <p className="admNote" role="status">{message}</p> : null}

      <ul className="admFacts">
        <li>
          <span>فرستنده</span>
          {ticket.user_id ? <button type="button" className="admLink" onClick={() => onGo("users", { userId: ticket.user_id })}>{ticket.user_name || "بدون نام"} ←</button> : <b>مهمان (بدون حساب)</b>}
        </li>
        {phone ? <li><span>شمارهٔ تماس</span><a className="admLink" href={`tel:${phone}`} dir="ltr"><Phone size={14} aria-hidden="true" /> {phone}</a></li> : null}
        {closed && ticket.resolution ? <li><span>نتیجه</span><b>{RESOLUTION_LABEL[ticket.resolution] || ticket.resolution}</b></li> : null}
      </ul>

      {isReport ? (
        <section className="admReportBox">
          <h3>مورد گزارش‌شده</h3>
          {target ? (
            <ul className="admFacts">
              {ticket.target_type === "post" ? (
                <>
                  <li><span>پست</span><b>{target.title}{target.is_public ? "" : " • پنهان"}</b></li>
                  <li><span>صاحب پست</span><button type="button" className="admLink" onClick={() => onGo("users", { userId: target.owner_id })}>{target.owner_name} ←</button></li>
                </>
              ) : (
                <li><span>حساب</span><button type="button" className="admLink" onClick={() => onGo("users", { userId: target.id })}>{target.name || "بدون نام"} ←</button></li>
              )}
            </ul>
          ) : <p className="admMuted">دیگر وجود ندارد (احتمالاً حذف شده).</p>}
          {!closed && target ? (
            <div className="admRowActions">
              {ticket.target_type === "post" && target.is_public ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ action: "hide_post", note }, "پست پنهان شد و گزارش بسته شد.")}>پنهان‌کردن پست</Button> : null}
              <Button size="sm" variant="danger" disabled={busy} onClick={() => window.confirm("حساب مربوط مسدود شود؟ بلافاصله از اپ خارج می‌شود.") && send({ action: "suspend_user", note }, "حساب مسدود شد و گزارش بسته شد.")}>مسدودکردن حساب</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ action: "dismiss", note }, "گزارش بدون اقدام بسته شد.")}>ایرادی نبود</Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3>گفتگو</h3>
        <div className="admThread" aria-live="polite">
          {messages.map((item) => (
            <div key={item.id} className={`admBubble is-${item.author}`}>
              <small>{item.author === "admin" ? "پشتیبانی" : ticket.user_name || "کاربر"} • {clock(item.created_at)}</small>
              <p>{item.body}</p>
            </div>
          ))}
          {!messages.length ? <p className="admMuted">{isReport ? "کاربر توضیحی ننوشته است." : "پیامی نیست."}</p> : null}
          <div ref={endRef} />
        </div>
        {canReply ? (
          <form className="admReply" onSubmit={(event) => { event.preventDefault(); send({ reply }, "پاسخ فرستاده شد.", () => setReply("")); }}>
            <Field label="پاسخ به کاربر" hideLabel>
              {(props) => <textarea {...props} rows={3} maxLength={2000} value={reply} placeholder="پاسخت را بنویس؛ کاربر در پشتیبانیِ خودش می‌بیند…" onChange={(event) => setReply(event.target.value)} />}
            </Field>
            <div className="admRowActions">
              <Button type="submit" size="sm" disabled={busy || !reply.trim()}><Send size={15} aria-hidden="true" /> ارسال پاسخ</Button>
              {!closed ? <Button type="button" size="sm" variant="secondary" disabled={busy || !reply.trim()} onClick={() => send({ reply, status: "closed" }, "پاسخ فرستاده شد و گفتگو بسته شد.", () => setReply(""))}>ارسال و بستن</Button> : null}
            </div>
          </form>
        ) : <p className="admMuted">این فرستنده حساب ندارد؛ فقط با شمارهٔ تماسش می‌شود جواب داد.</p>}
      </section>

      <section>
        <h3>یادداشت داخلی</h3>
        <p className="admMuted">فقط خودت می‌بینی.</p>
        <Field label="یادداشت" hideLabel>{(props) => <textarea {...props} rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />}</Field>
        <div className="admRowActions">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ note }, "یادداشت ذخیره شد.")}>ذخیرهٔ یادداشت</Button>
          {closed ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ status: "open" }, "دوباره باز شد.")}>بازکردن دوباره</Button>
          ) : (
            <>
              {ticket.status !== "in_progress" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ status: "in_progress", note }, "در حال بررسی.")}>در حال بررسی</Button> : null}
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ status: "closed", note }, "بسته شد.")}>بستن بدون پاسخ</Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const VIEWS = [
  ["admin", "منتظر پاسخ من"],
  ["user", "منتظر کاربر"],
  ["closed", "بسته‌شده"],
  ["all", "همه"]
];

/** The support inbox: who is waiting for you, a conversation on the side, and the tools to deal with reports. */
export function SupportTab({ intent = {}, onChanged, onGo }) {
  const [view, setView] = useState("admin");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ tickets: [], total: 0, counts: {} });
  const [selected, setSelected] = useState(intent.ticketId || null);

  const load = useCallback(async () => {
    const params = { kind, q, offset: String(offset), limit: String(PAGE) };
    if (view === "admin" || view === "user") params.awaiting = view;
    if (view === "closed") params.status = "closed";
    const { ok, payload } = await apiFetch(`/api/admin/support?${new URLSearchParams(params)}`);
    if (ok) setData(payload.data);
  }, [view, kind, q, offset]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };
  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;
  const count = (key) => num(data.counts?.[key] || 0);
  const info = tabInfo("support");

  const list = (
    <section className="admCard">
      <div className="admFilters">
        <Field label="جستجو در پیام‌ها" hideLabel>
          {(props) => <input {...props} type="search" placeholder="موضوع، متن، نام یا شماره…" value={q} onChange={(event) => { setQ(event.target.value); setOffset(0); }} />}
        </Field>
        <div className="admChips" role="group" aria-label="نمای صندوق">
          {VIEWS.map(([value, label]) => {
            const n = value === "admin" ? count("awaiting_admin") : value === "user" ? count("awaiting_user") : value === "closed" ? count("closed") : "";
            return <Chip key={value} selected={view === value} onClick={() => { setView(value); setOffset(0); }}>{label}{n !== "" ? ` (${n})` : ""}</Chip>;
          })}
        </div>
        <div className="admChips" role="group" aria-label="نوع">
          {[["", "همه"], ["support", "پیام‌ها"], ["report", "گزارش‌ها"]].map(([value, label]) => (
            <Chip key={value || "all"} selected={kind === value} onClick={() => { setKind(value); setOffset(0); }}>{label}</Chip>
          ))}
        </div>
      </div>
      {data.tickets.length ? (
        <ul className="admInbox">
          {data.tickets.map((ticket) => (
            <li key={ticket.id} className={`${ticket.status === "closed" ? "is-closed" : ""}${selected === ticket.id ? " is-selected" : ""}`}>
              <button type="button" onClick={() => setSelected(ticket.id)} aria-label={`${ticket.subject || "بدون موضوع"} — ${ticket.user_name || ticket.phone || "مهمان"}`}>
                <span className={`admTicketIcon is-${ticket.kind}`}>{ticket.kind === "report" ? <Flag size={16} aria-hidden="true" /> : <MessageSquare size={16} aria-hidden="true" />}</span>
                <span className="admInboxBody">
                  <b>{ticket.subject || (ticket.last_body || "").slice(0, 60) || "بدون موضوع"}</b>
                  <small>{ticket.user_name || "مهمان"} • {labelOf(ticket)}{ticket.last_body ? ` • ${ticket.last_body.slice(0, 40)}` : ""}</small>
                </span>
                <span className="admInboxMeta"><TurnPill ticket={ticket} /><time dateTime={ticket.last_message_at}>{ago(ticket.last_message_at)}</time></span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="admMuted admEmptyNote">{view === "admin" ? "همهٔ پیام‌ها پاسخ داده شده‌اند 🎉" : "موردی نیست."}</p>}
      <footer className="admPager">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>قبلی</Button>
        <span>{num(data.total)} مورد • صفحهٔ {num(page)} از {num(pages)}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}>بعدی</Button>
      </footer>
    </section>
  );

  return (
    <>
      <PageHead title={info.label} desc={info.desc} />
      <SplitView
        list={list}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        label="گفتگو"
        emptyHint="یک پیام را از فهرست باز کن تا گفتگو و ابزارهای رسیدگی را ببینی."
        detail={selected ? <TicketDetail key={selected} id={selected} onChanged={changed} onGo={onGo} /> : null}
      />
    </>
  );
}
