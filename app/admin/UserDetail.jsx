"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { adminFetch } from "./adminFetch";
import { Button, Field } from "../components/ui";
import { TYPE_LABEL, fmtDate, num } from "./format";

/** Everything about one account, plus the dangerous actions (sign out everywhere, delete). */
export function UserDetail({ userId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch(`/api/admin/users/${userId}`).then(({ ok, payload }) => setDetail(ok ? payload.data : { error: payload.error || "بارگذاری نشد." }));
  }, [userId]);

  async function forceLogout() {
    const { ok, payload } = await adminFetch(`/api/admin/users/${userId}/logout`, { method: "POST" });
    setMessage(ok ? "کاربر از همهٔ دستگاه‌ها خارج شد." : payload.error || "انجام نشد.");
    if (ok) onChanged();
  }

  async function remove() {
    const { ok, payload } = await adminFetch(`/api/admin/users/${userId}`, { method: "DELETE", body: JSON.stringify({ confirmPhone }) });
    if (ok) {
      onChanged();
      onClose();
    } else setMessage(payload.error || "حذف نشد.");
  }

  if (!detail) return <section className="admCard"><p className="admMuted">در حال بارگذاری…</p></section>;
  if (detail.error) return <section className="admCard"><p className="admError" role="alert">{detail.error}</p><Button size="sm" variant="secondary" onClick={onClose}>بستن</Button></section>;
  const { user } = detail;
  return (
    <section className="admCard">
      <div className="admHead">
        <h2>{user.name || "بدون نام"} <small className="admMuted">{TYPE_LABEL[user.type] || user.type}{detail.isAdmin ? " • مدیر" : ""}</small></h2>
        <Button size="sm" variant="secondary" onClick={onClose}>بستن</Button>
      </div>
      {message ? <p className="admNote" role="status">{message}</p> : null}
      <ul className="admList">
        <li><span>شماره</span><b dir="ltr">{user.phone}</b></li>
        {user.email ? <li><span>ایمیل</span><b dir="ltr">{user.email}</b></li> : null}
        <li><span>منطقه / خدمت</span><b>{[user.area, user.service].filter(Boolean).join(" • ") || "—"}</b></li>
        <li><span>عضویت</span><b>{fmtDate(user.created_at)}</b></li>
        <li><span>آخرین بازدید</span><b>{fmtDate(user.last_seen_at)}</b></li>
        <li><span>وضعیت</span><b>{user.suspended_at ? `مسدود از ${fmtDate(user.suspended_at)}` : "فعال"}</b></li>
        <li><span>پست‌ها / دنبال‌کنندگان / رزروها</span><b>{num(detail.counts.posts)} / {num(detail.counts.followers)} / {num(detail.counts.bookings)}</b></li>
        <li><span>نشست‌های فعال</span><b>{num(detail.activeSessions)}</b></li>
      </ul>
      {detail.recentBookings.length ? (
        <>
          <h2>آخرین رزروها</h2>
          <ul className="admList">
            {detail.recentBookings.map((booking) => (
              <li key={`${booking.kind}-${booking.id}`}><span>{booking.service || "—"} • {booking.booking_date} {booking.time}</span><small>{booking.status}</small></li>
            ))}
          </ul>
        </>
      ) : null}
      {detail.isAdmin ? (
        <p className="admMuted">حساب مدیر را از اینجا نمی‌شود مسدود یا حذف کرد.</p>
      ) : (
        <div className="admForm">
          <Button size="sm" variant="secondary" onClick={forceLogout}>خروج از همهٔ دستگاه‌ها</Button>
          {deleting ? (
            <>
              <Field label={`برای تأیید حذف دائمی، شمارهٔ ${user.phone} را تایپ کن`}>{(p) => <input {...p} dir="ltr" value={confirmPhone} onChange={(event) => setConfirmPhone(event.target.value)} />}</Field>
              <Button size="sm" variant="danger" disabled={confirmPhone.trim() !== user.phone} onClick={remove}>حذف دائمی حساب و همهٔ داده‌هایش</Button>
            </>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setDeleting(true)}>حذف حساب…</Button>
          )}
        </div>
      )}
    </section>
  );
}
