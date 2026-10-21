"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarX2, Download, Phone, Search, Store, UserRound } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { BOOKING_TONE, TYPE_LABEL, ago, fmtDate, fmtKey, fmtTime, num } from "./format";
import { PageHead } from "./PageHead";
import { SplitView } from "./SplitView";
import { EmptyState, ErrorNote, Loading, Pager, Segmented, Skeleton, confirmAction, exportCsv, toastResult, useAdminData, withQuery } from "./ui";

const PAGE_SIZE = 30;
const WHEN = [{ value: "", label: "همه" }, { value: "today", label: "امروز" }, { value: "upcoming", label: "آینده" }, { value: "past", label: "گذشته" }];
const KIND = [{ value: "", label: "همه" }, { value: "salon", label: "سالن" }, { value: "artist", label: "آرتیست" }];
const keyOf = (kind, id) => (kind && id ? `${kind}-${id}` : null);

export function StatusTag({ status }) {
  return <span className={`admTone is-${BOOKING_TONE[status] || "muted"}`}>{status}</span>;
}

/** One booking: when and what, both people (each opens their account), reminders sent, and cancelling with a reason. */
function BookingDetail({ kind, id, onGo, onChanged }) {
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await api.get(`/api/admin/bookings/${kind}/${id}`);
    setFound(result.ok ? result.payload.data : { error: result.payload?.error || "بارگذاری نشد." });
  }, [kind, id]);
  useEffect(() => {
    setFound(null);
    load();
  }, [load]);

  if (!found) return <Loading />;
  if (found.error) return <ErrorNote error={found.error} onRetry={load} />;
  const { booking, provider, client } = found;

  async function cancel() {
    const answer = await confirmAction({
      title: "این رزرو لغو شود؟",
      body: "رزرو برای هر دو طرف لغو می‌شود و وقتش آزاد می‌شود. به مشتری و سالن یا آرتیست اعلان می‌رود (اگر اعلان را روشن کرده باشند).",
      danger: true,
      confirmLabel: "لغو رزرو",
      reason: { label: "دلیل لغو (در اعلان هم می‌آید)", required: true, placeholder: "مثلاً: درخواست جعلی، شکایت مشتری" }
    });
    if (!answer.ok) return;
    setBusy(true);
    const result = await api.post(`/api/admin/bookings/${kind}/${id}`, { action: "cancel", reason: answer.reason });
    setBusy(false);
    if (toastResult(result, "رزرو لغو شد.")) {
      load();
      onChanged?.();
    }
  }

  const person = (who, fallbackName, fallbackPhone, Icon, role) => (
    <div className="admPerson">
      <span className="admPersonIcon"><Icon size={17} aria-hidden="true" /></span>
      <div>
        <small>{role}</small>
        {who ? (
          <button type="button" className="admRowLink" onClick={() => onGo("users", { id: who.id })}>{who.name || "بدون نام"} ←</button>
        ) : <b>{fallbackName || "—"}</b>}
        <span className="admMuted" dir="ltr">{who?.phone || fallbackPhone || ""}</span>
        {who?.suspended_at ? <span className="admTone is-bad">مسدود</span> : null}
      </div>
      {(who?.phone || fallbackPhone) ? <a className="admIconBtn" href={`tel:${who?.phone || fallbackPhone}`} aria-label="تماس"><Phone size={15} aria-hidden="true" /></a> : null}
    </div>
  );

  return (
    <div className="admDetail">
      <header className="admDetailHead">
        <span className="admTicketIcon"><CalendarCheck size={18} aria-hidden="true" /></span>
        <div>
          <h2>{booking.service || "رزرو"}</h2>
          <p className="admMuted">{kind === "salon" ? "رزرو سالن" : "رزرو آرتیست"} • شمارهٔ {num(booking.id)}</p>
        </div>
        <StatusTag status={booking.status} />
      </header>

      <div className="admWhen">
        <div><small>روز</small><b>{fmtKey(booking.booking_date)}</b></div>
        <div><small>ساعت</small><b>{fmtTime(booking.time)}</b></div>
        <div><small>مدت</small><b>{num(booking.duration_minutes)} دقیقه</b></div>
      </div>

      {person(client, booking.client_name, booking.client_phone, UserRound, client ? "مشتری" : "مشتری (بدون حساب)")}
      {person(provider, "", "", Store, provider ? TYPE_LABEL[provider.type] || "ارائه‌دهنده" : "ارائه‌دهنده (حذف شده)")}

      <ul className="admFacts">
        {booking.staff ? <li><span>آرتیست سالن</span><b>{booking.staff}</b></li> : null}
        <li><span>ثبت</span><b>{fmtDate(booking.created_at)} ({ago(booking.created_at)})</b></li>
        {booking.updated_at ? <li><span>آخرین تغییر</span><b>{fmtDate(booking.updated_at)}</b></li> : null}
        <li><span>یادآوری‌های فرستاده‌شده</span><b>{found.reminders.length ? found.reminders.map((row) => (row.kind === "day" ? "یک روز قبل" : "دو ساعت قبل")).join("، ") : "هنوز نه"}</b></li>
      </ul>

      {found.history.length ? (
        <section>
          <h3>اقدام مدیر</h3>
          <ul className="admTimeline">
            {found.history.map((row) => <li key={row.id}><b>لغو توسط مدیر</b><p>{row.detail.split(" • ").slice(1).join(" • ")}</p><small>{fmtDate(row.created_at)} • <span dir="ltr">{row.admin_label}</span></small></li>)}
          </ul>
        </section>
      ) : null}

      {found.cancellable ? (
        <section className="admDanger">
          <h3>لغو رزرو</h3>
          <p className="admMuted">برای شکایت یا درخواست جعلی. لغو از همان مسیری انجام می‌شود که سالن یا مشتری لغو می‌کنند، پس تقویم آرتیست هم درست می‌ماند.</p>
          <Button size="sm" variant="danger" disabled={busy} onClick={cancel}><CalendarX2 size={15} aria-hidden="true" /> لغو این رزرو</Button>
        </section>
      ) : <p className="admMuted">این رزرو {booking.status === "لغو" || booking.status === "منقضی شده" ? "بسته شده" : "گذشته"} است و دیگر لغو نمی‌شود.</p>}
    </div>
  );
}

/** Every booking (salon and independent artist), filterable by day, kind, status and text; one booking at a time beside the list. */
export function BookingsTab({ intent = {}, onGo, setParam }) {
  const [q, setQ] = useState(intent.q || "");
  const [status, setStatus] = useState(intent.status || "");
  const [when, setWhen] = useState(intent.when || "");
  const [kind, setKind] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(keyOf(intent.kind, intent.id));

  const path = withQuery("/api/admin/bookings", { q: q.trim(), status, when, kind, offset, limit: PAGE_SIZE });
  const { data, error, loading, reload } = useAdminData(path, { debounce: q ? 250 : 0 });
  useEffect(() => {
    const [k, id] = selected ? selected.split("-") : [null, null];
    setParam?.("kind", k);
    setParam?.("id", id);
  }, [selected, setParam]);

  const reset = (fn) => (value) => {
    fn(value);
    setOffset(0);
  };
  const statuses = data?.statuses || [];
  const bookings = data?.bookings || [];
  const [selKind, selId] = selected ? selected.split("-") : [];

  const list = (
    <section className="admCard admListCard">
      <div className="admToolbar">
        <label className="admInlineSearch">
          <Search size={17} aria-hidden="true" />
          <input type="search" value={q} placeholder="نام یا شمارهٔ مشتری، سالن، آرتیست یا خدمت…" aria-label="جست‌وجو در رزروها" onChange={(event) => reset(setQ)(event.target.value)} />
        </label>
        <Segmented label="زمان رزرو" size="sm" value={when} onChange={reset(setWhen)} options={WHEN} />
        <Segmented label="نوع" size="sm" value={kind} onChange={reset(setKind)} options={KIND} />
      </div>
      <div className="admChipsRow" role="group" aria-label="وضعیت">
        <button type="button" className={`admTag${status === "" ? " is-on" : ""}`} onClick={() => reset(setStatus)("")}>همهٔ وضعیت‌ها</button>
        {statuses.map((item) => (
          <button key={item.status} type="button" className={`admTag is-${BOOKING_TONE[item.status] || "muted"}${status === item.status ? " is-on" : ""}`} onClick={() => reset(setStatus)(item.status)}>
            {item.status} <i>{num(item.count)}</i>
          </button>
        ))}
      </div>
      <ErrorNote error={error} onRetry={reload} />
      {!data && loading ? <Skeleton rows={8} /> : null}
      {data ? (
        bookings.length ? (
          <div className={`admTableWrap${loading ? " is-stale" : ""}`}>
            <table className="admTable is-clickable">
              <thead><tr><th>مشتری</th><th>ارائه‌دهنده</th><th>خدمت</th><th>زمان</th><th>وضعیت</th></tr></thead>
              <tbody>
                {bookings.map((booking) => {
                  const key = keyOf(booking.kind, booking.id);
                  return (
                    <tr key={key} className={selected === key ? "is-selected" : ""} onClick={() => setSelected(key)}>
                      <td><button type="button" className="admRowLink" onClick={(event) => { event.stopPropagation(); setSelected(key); }}>{booking.client || "—"}</button><small dir="ltr">{booking.phone}</small></td>
                      <td>{booking.provider || "—"} <small>{booking.kind === "salon" ? "سالن" : "آرتیست"}</small></td>
                      <td>{booking.service || "—"}</td>
                      <td>{fmtKey(booking.booking_date)} <small>{fmtTime(booking.time)}</small></td>
                      <td><StatusTag status={booking.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={CalendarCheck} title="رزروی پیدا نشد">فیلترها را تغییر بده.</EmptyState>
      ) : null}
      {data ? <Pager total={data.total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} noun="رزرو" /> : null}
    </section>
  );

  return (
    <>
      <PageHead tab="bookings">
        <Button variant="secondary" size="sm" onClick={() => exportCsv("bookings")}><Download size={16} aria-hidden="true" /> خروجی اکسل</Button>
      </PageHead>
      <SplitView
        list={list}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        label="جزئیات رزرو"
        detail={selected ? <BookingDetail key={selected} kind={selKind} id={selId} onGo={onGo} onChanged={reload} /> : null}
      />
    </>
  );
}
