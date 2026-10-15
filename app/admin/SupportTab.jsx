"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, LifeBuoy, MessageSquare, Phone, Search, Send } from "lucide-react";
import { Button, Field } from "../components/ui";
import { api } from "./adminFetch";
import { CannedReplies } from "./CannedReplies";
import { CATEGORY_LABEL, PAGE, REASON_LABEL, RESOLUTION_LABEL, ago, fmtDate } from "./format";
import { PageHead } from "./PageHead";
import { SplitView } from "./SplitView";
import { EmptyState, ErrorNote, Loading, Pager, Segmented, Skeleton, confirmAction, toast, useAdminData, withQuery } from "./ui";

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
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    const { ok, payload } = await api.get(`/api/admin/support/${id}`);
    if (ok) {
      setFound(payload.data);
      setNote(payload.data.ticket.admin_note || "");
    } else setFound({ error: payload.error || "بارگذاری نشد." });
  }, [id]);
  useEffect(() => {
    setFound(null);
    setReply("");
    load();
  }, [load]);
  const count = found?.messages?.length || 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  async function send(body, done, after) {
    setBusy(true);
    const { ok, payload } = await api.post(`/api/admin/support/${id}`, body);
    setBusy(false);
    toast(ok ? done : payload.error || "انجام نشد.", ok ? "success" : "error");
    if (ok) {
      after?.();
      await load();
      onChanged();
    }
  }

  if (!found) return <Loading />;
  if (found.error) return <ErrorNote error={found.error} onRetry={load} />;
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

      <ul className="admFacts">
        <li>
          <span>فرستنده</span>
          {ticket.user_id ? <button type="button" className="admLink" onClick={() => onGo("users", { id: ticket.user_id })}>{ticket.user_name || "بدون نام"} ←</button> : <b>مهمان (بدون حساب)</b>}
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
                  <li><span>صاحب پست</span><button type="button" className="admLink" onClick={() => onGo("users", { id: target.owner_id })}>{target.owner_name} ←</button></li>
                </>
              ) : (
                <li><span>حساب</span><button type="button" className="admLink" onClick={() => onGo("users", { id: target.id })}>{target.name || "بدون نام"} ←</button></li>
              )}
            </ul>
          ) : <p className="admMuted">دیگر وجود ندارد (احتمالاً حذف شده).</p>}
          {!closed && target ? (
            <div className="admRowActions">
              {ticket.target_type === "post" && target.is_public ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ action: "hide_post", note }, "پست پنهان شد و گزارش بسته شد.")}>پنهان‌کردن پست</Button> : null}
              <Button size="sm" variant="danger" disabled={busy} onClick={async () => (await confirmAction({ title: "حساب مربوط مسدود شود؟", body: "بلافاصله از اپ خارج می‌شود و گزارش بسته می‌شود.", danger: true, confirmLabel: "مسدود شود" })).ok && send({ action: "suspend_user", note }, "حساب مسدود شد و گزارش بسته شد.")}>مسدودکردن حساب</Button>
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
            <CannedReplies onPick={(body) => setReply((prev) => (prev ? `${prev}\n${body}` : body))} />
            <Field label="پاسخ به کاربر" hideLabel>
              {(props) => (
                <textarea
                  {...props}
                  rows={3}
                  maxLength={2000}
                  value={reply}
                  placeholder="پاسخت را بنویس؛ کاربر در پشتیبانیِ خودش می‌بیند… (Ctrl+Enter برای ارسال)"
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && reply.trim() && !busy) {
                      event.preventDefault();
                      send({ reply }, "پاسخ فرستاده شد.", () => setReply(""));
                    }
                  }}
                />
              )}
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
export function SupportTab({ intent = {}, onChanged, onGo, setParam }) {
  const [view, setView] = useState(intent.id || intent.q ? "all" : "admin");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState(intent.q || "");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(Number(intent.id) || null);

  const params = { kind, q: q.trim(), offset, limit: PAGE };
  if (view === "admin" || view === "user") params.awaiting = view;
  if (view === "closed") params.status = "closed";
  const { data, error, loading, reload } = useAdminData(withQuery("/api/admin/support", params), { debounce: q ? 250 : 0, every: 45 * 1000 });
  useEffect(() => {
    setParam?.("id", selected);
  }, [selected, setParam]);

  const changed = () => {
    reload();
    onChanged?.();
  };
  const reset = (fn) => (value) => {
    fn(value);
    setOffset(0);
  };
  const counts = data?.counts || {};
  const tickets = data?.tickets || [];

  const list = (
    <section className="admCard admListCard">
      <div className="admToolbar">
        <label className="admInlineSearch">
          <Search size={17} aria-hidden="true" />
          <input type="search" value={q} placeholder="موضوع، متن، نام یا شماره…" aria-label="جست‌وجو در پیام‌ها" onChange={(event) => reset(setQ)(event.target.value)} />
        </label>
        <Segmented label="نوع" size="sm" value={kind} onChange={reset(setKind)} options={[{ value: "", label: "همه" }, { value: "support", label: "پیام‌ها" }, { value: "report", label: "گزارش‌ها", icon: Flag }]} />
      </div>
      <Segmented
        label="نمای صندوق"
        size="sm"
        value={view}
        onChange={reset(setView)}
        options={VIEWS.map(([value, label]) => ({ value, label, count: value === "admin" ? counts.awaiting_admin : value === "user" ? counts.awaiting_user : value === "closed" ? counts.closed : undefined }))}
      />
      <ErrorNote error={error} onRetry={reload} />
      {!data && loading ? <Skeleton rows={6} /> : null}
      {data ? (
        tickets.length ? (
          <ul className={`admInbox${loading ? " is-stale" : ""}`}>
            {tickets.map((ticket) => (
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
        ) : view === "admin" ? <EmptyState icon={LifeBuoy} title="همهٔ پیام‌ها پاسخ داده شده‌اند">پیام تازه که بیاید، اینجا و روی زنگ بالای صفحه می‌بینی.</EmptyState> : <EmptyState icon={LifeBuoy} title="موردی نیست" />
      ) : null}
      {data ? <Pager total={data.total} offset={offset} limit={PAGE} onChange={setOffset} noun="مورد" /> : null}
    </section>
  );

  return (
    <>
      <PageHead tab="support" />
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
