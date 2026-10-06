"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { Button, Chip, Field } from "../components/ui";
import { PAGE, fmtDate, num } from "./format";

/** Read-only view of every booking (salon and independent artist), for investigating complaints. */
export function BookingsTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ bookings: [], total: 0, statuses: [] });

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ q, status, offset: String(offset), limit: String(PAGE) });
    const { ok, payload } = await apiFetch(`/api/admin/bookings?${qs}`);
    if (ok) setData(payload.data);
  }, [q, status, offset]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;
  return (
    <section className="admCard">
      <div className="admFilters">
        <Field label="جستجو در رزروها" hideLabel>
          {(props) => <input {...props} type="search" placeholder="نام یا شمارهٔ مشتری، ارائه‌دهنده یا خدمت…" value={q} onChange={(event) => { setQ(event.target.value); setOffset(0); }} />}
        </Field>
        <div className="admChips" role="group" aria-label="وضعیت رزرو">
          <Chip selected={status === ""} onClick={() => { setStatus(""); setOffset(0); }}>همه</Chip>
          {data.statuses.map((item) => (
            <Chip key={item.status} selected={status === item.status} onClick={() => { setStatus(item.status); setOffset(0); }}>{item.status} ({num(item.count)})</Chip>
          ))}
        </div>
      </div>
      <div className="admTableWrap">
        <table className="admTable">
          <thead><tr><th>مشتری</th><th>ارائه‌دهنده</th><th>خدمت</th><th>زمان</th><th>وضعیت</th><th>ثبت</th></tr></thead>
          <tbody>
            {data.bookings.map((booking) => (
              <tr key={`${booking.kind}-${booking.id}`}>
                <td>{booking.client || "—"} <small dir="ltr">{booking.phone}</small></td>
                <td>{booking.provider || "—"} <small>{booking.kind === "salon" ? "سالن" : "آرتیست"}</small></td>
                <td>{booking.service || "—"}</td>
                <td>{booking.booking_date} {booking.time}</td>
                <td>{booking.status}</td>
                <td>{fmtDate(booking.created_at)}</td>
              </tr>
            ))}
            {!data.bookings.length ? <tr><td colSpan={6} className="admMuted">رزروی پیدا نشد.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <footer className="admPager">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>قبلی</Button>
        <span>{num(data.total)} رزرو • صفحهٔ {num(page)} از {num(pages)}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}>بعدی</Button>
      </footer>
    </section>
  );
}
