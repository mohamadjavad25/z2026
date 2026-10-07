"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, MessageSquare, Phone } from "lucide-react";
import { apiFetch } from "../shared/api/client";
import { Button, Chip, Field } from "../components/ui";
import { CATEGORY_LABEL, PAGE, REASON_LABEL, RESOLUTION_LABEL, STATUS_LABEL, ago, fmtDate, num } from "./format";

const labelOf = (ticket) => (ticket.kind === "report" ? REASON_LABEL[ticket.category] : CATEGORY_LABEL[ticket.category]) || ticket.category;

function StatusPill({ status }) {
  return <span className={`admPill admStatus is-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

/** One ticket: what was written, who wrote it, what was reported, and the buttons to deal with it. */
function TicketDetail({ id, onClose, onChanged }) {
  const [found, setFound] = useState(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { ok, payload } = await apiFetch(`/api/admin/support/${id}`);
    if (ok) {
      setFound(payload.data);
      setNote(payload.data.ticket.admin_note || "");
    } else setFound({ error: payload.error || "بارگذاری نشد." });
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function send(body, done) {
    setBusy(true);
    const { ok, payload } = await apiFetch(`/api/admin/support/${id}`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    setMessage(ok ? done : payload.error || "انجام نشد.");
    if (ok) {
      await load();
      onChanged();
    }
  }

  if (!found) return <section className="admCard"><p className="admMuted">در حال بارگذاری…</p></section>;
  if (found.error) return <section className="admCard"><p className="admError" role="alert">{found.error}</p><Button size="sm" variant="secondary" onClick={onClose}>بستن</Button></section>;
  const { ticket, target } = found;
  const isReport = ticket.kind === "report";
  const phone = ticket.contact_phone || ticket.user_phone;
  const closed = ticket.status === "closed";
  return (
    <section className="admCard admTicket">
      <div className="admHead">
        <h2>{isReport ? <Flag size={18} aria-hidden="true" /> : <MessageSquare size={18} aria-hidden="true" />} {ticket.subject || (isReport ? "گزارش" : "پیام")}</h2>
        <Button size="sm" variant="secondary" onClick={onClose}>بستن</Button>
      </div>
      {message ? <p className="admNote" role="status">{message}</p> : null}
      <div className="admTicketMeta">
        <StatusPill status={ticket.status} />
        <span className="admPill">{labelOf(ticket)}</span>
        {closed && ticket.resolution ? <span className="admPill is-client">{RESOLUTION_LABEL[ticket.resolution] || ticket.resolution}</span> : null}
        <small>{fmtDate(ticket.created_at)}</small>
      </div>
      {ticket.body ? <p className="admTicketBody">{ticket.body}</p> : <p className="admMuted">توضیحی نوشته نشده.</p>}
      <ul className="admList">
        <li>
          <span>فرستنده</span>
          <b>{ticket.user_name || "مهمان (بدون حساب)"}{ticket.user_type ? <small> • {ticket.user_type}</small> : null}</b>
        </li>
        {phone ? (
          <li>
            <span>شمارهٔ تماس</span>
            <a className="admLink" href={`tel:${phone}`} dir="ltr"><Phone size={14} aria-hidden="true" /> {phone}</a>
          </li>
        ) : null}
      </ul>

      {isReport ? (
        <>
          <h2>مورد گزارش‌شده</h2>
          {target ? (
            <ul className="admList">
              {ticket.target_type === "post" ? (
                <>
                  <li><span>پست</span><b>{target.title}{target.is_public ? "" : " • پنهان"}</b></li>
                  <li><span>صاحب پست</span><b>{target.owner_name} <small dir="ltr">{target.owner_phone}</small></b></li>
                </>
              ) : (
                <li><span>حساب</span><b>{target.name || "بدون نام"} <small dir="ltr">{target.phone}</small>{target.suspended_at ? " • مسدود" : ""}</b></li>
              )}
            </ul>
          ) : <p className="admMuted">مورد گزارش‌شده دیگر وجود ندارد (احتمالاً حذف شده).</p>}
          {!closed && target ? (
            <div className="admRowActions">
              {ticket.target_type === "post" && target.is_public ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ action: "hide_post", note }, "پست پنهان شد و گزارش بسته شد.")}>پنهان‌کردن پست</Button> : null}
              <Button size="sm" variant="danger" disabled={busy} onClick={() => window.confirm("حساب مربوط مسدود شود؟ بلافاصله از اپ خارج می‌شود.") && send({ action: "suspend_user", note }, "حساب مسدود شد و گزارش بسته شد.")}>مسدودکردن حساب</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ action: "dismiss", note }, "گزارش بدون اقدام بسته شد.")}>ایرادی نبود</Button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="admForm">
        <Field label="یادداشت داخلی (فقط خودت می‌بینی)">
          {(props) => <textarea {...props} rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />}
        </Field>
        <div className="admRowActions">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ note }, "یادداشت ذخیره شد.")}>ذخیرهٔ یادداشت</Button>
          {ticket.status !== "in_progress" && !closed ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ status: "in_progress", note }, "در حال بررسی.")}>در حال بررسی</Button> : null}
          {closed ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ status: "open" }, "دوباره باز شد.")}>بازکردن دوباره</Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => send({ status: "closed", note }, "بسته شد.")}>بستن تیکت</Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** The support inbox: messages from users and reports about posts/accounts, open ones first. */
export function SupportTab({ onChanged }) {
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ tickets: [], total: 0, counts: {} });
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ status, kind, q, offset: String(offset), limit: String(PAGE) });
    const { ok, payload } = await apiFetch(`/api/admin/support?${qs}`);
    if (ok) setData(payload.data);
  }, [status, kind, q, offset]);
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
  const count = (key) => num(data.counts[key] || 0);
  return (
    <>
      {selected ? <TicketDetail key={selected} id={selected} onClose={() => setSelected(null)} onChanged={changed} /> : null}
      <section className="admCard">
        <div className="admFilters">
          <Field label="جستجو در پیام‌ها" hideLabel>
            {(props) => <input {...props} type="search" placeholder="موضوع، متن، نام یا شماره…" value={q} onChange={(event) => { setQ(event.target.value); setOffset(0); }} />}
          </Field>
          <div className="admChips" role="group" aria-label="وضعیت">
            {[["open", `باز (${count("open")})`], ["in_progress", `در حال بررسی (${count("in_progress")})`], ["closed", `بسته (${count("closed")})`], ["", "همه"]].map(([value, label]) => (
              <Chip key={value || "all"} selected={status === value} onClick={() => { setStatus(value); setOffset(0); }}>{label}</Chip>
            ))}
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
              <li key={ticket.id} className={ticket.status === "closed" ? "is-closed" : ""}>
                <button type="button" onClick={() => setSelected(ticket.id)} aria-label={`${ticket.subject || "بدون موضوع"} — ${ticket.user_name || ticket.phone || "مهمان"}`}>
                  <span className={`admTicketIcon is-${ticket.kind}`}>{ticket.kind === "report" ? <Flag size={16} aria-hidden="true" /> : <MessageSquare size={16} aria-hidden="true" />}</span>
                  <span className="admInboxBody">
                    <b>{ticket.subject || (ticket.body || "").slice(0, 60) || "بدون موضوع"}</b>
                    <small>{ticket.user_name || "مهمان"} • <span dir="ltr">{ticket.phone || "—"}</span> • {labelOf(ticket)}</small>
                  </span>
                  <StatusPill status={ticket.status} />
                  <time dateTime={ticket.created_at}>{ago(ticket.created_at)}</time>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="admMuted">موردی پیدا نشد. {status === "open" ? "همهٔ پیام‌ها رسیدگی شده‌اند 🎉" : ""}</p>}
        <footer className="admPager">
          <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>قبلی</Button>
          <span>{num(data.total)} مورد • صفحهٔ {num(page)} از {num(pages)}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}>بعدی</Button>
        </footer>
      </section>
    </>
  );
}
