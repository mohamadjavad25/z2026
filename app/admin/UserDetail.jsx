"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, KeyRound, LogOut, MessageSquarePlus, ShieldCheck, Trash2 } from "lucide-react";
import { apiFetch } from "../shared/api/client";
import { adminFetch } from "./adminFetch";
import { Button, Field } from "../components/ui";
import { Avatar } from "./Avatar";
import { STATUS_LABEL, TYPE_LABEL, ago, fmtDate, num } from "./format";

const PANES = [
  ["overview", "نمای کلی"],
  ["edit", "ویرایش"],
  ["message", "پیام"],
  ["actions", "اقدام‌ها"]
];

/**
 * One account, organised in four clear panes: overview (facts, activity, private note), edit (fix the profile),
 * message (talk to them in their support inbox) and actions (suspend, sign out, set a password, delete).
 */
export function UserDetail({ userId, onChanged, onGo }) {
  const [detail, setDetail] = useState(null);
  const [pane, setPane] = useState("overview");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");

  const load = useCallback(async () => {
    const { ok, payload } = await apiFetch(`/api/admin/users/${userId}`);
    if (!ok) return setDetail({ error: payload.error || "بارگذاری نشد." });
    setDetail(payload.data);
    const { user } = payload.data;
    setForm({ name: user.name || "", area: user.area || "", service: user.service || "", email: user.email || "", bio: user.bio || "" });
    setNote(payload.data.note?.note || "");
  }, [userId]);
  useEffect(() => {
    setDetail(null);
    setPane("overview");
    setMessage("");
    load();
  }, [load]);

  async function run(fn, done, after) {
    setBusy(true);
    setMessage("");
    const { ok, payload } = await fn();
    setBusy(false);
    setMessage(ok ? done : payload.error || "انجام نشد.");
    if (ok) {
      await load();
      onChanged?.();
      after?.();
    }
    return ok;
  }

  if (!detail) return <p className="admMuted">در حال بارگذاری…</p>;
  if (detail.error) return <p className="admError" role="alert">{detail.error}</p>;
  const { user, counts } = detail;
  const suspended = Boolean(user.suspended_at);
  return (
    <div className="admDetail">
      <header className="admDetailHead">
        <Avatar name={user.name} phone={user.phone} />
        <div>
          <h2>{user.name || "بدون نام"}</h2>
          <p className="admMuted"><span className={`admPill is-${user.type}`}>{TYPE_LABEL[user.type] || user.type}</span> <span dir="ltr">{user.phone}</span></p>
        </div>
        <span className={`admDot${suspended ? " is-off" : ""}`}>{suspended ? "مسدود" : "فعال"}</span>
      </header>

      <div className="admPanes" role="tablist" aria-label="بخش‌های این کاربر">
        {PANES.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={pane === id} className={pane === id ? "is-on" : ""} onClick={() => { setPane(id); setMessage(""); }}>{label}</button>
        ))}
      </div>
      {message ? <p className="admNote" role="status">{message}</p> : null}

      {pane === "overview" ? (
        <>
          <ul className="admFacts">
            <li><span>عضویت</span><b>{fmtDate(user.created_at)}</b></li>
            <li><span>آخرین بازدید</span><b>{user.last_seen_at ? ago(user.last_seen_at) : "—"}</b></li>
            <li><span>منطقه و خدمت</span><b>{[user.area, user.service].filter(Boolean).join(" • ") || "—"}</b></li>
            {user.email ? <li><span>ایمیل</span><b dir="ltr">{user.email}</b></li> : null}
            <li><span>نشست فعال</span><b>{num(detail.activeSessions)}</b></li>
          </ul>
          <div className="admMiniStats">
            <div><b>{num(counts.posts)}</b><small>پست</small></div>
            <div><b>{num(counts.followers)}</b><small>دنبال‌کننده</small></div>
            <div><b>{num(counts.bookings)}</b><small>رزرو</small></div>
          </div>

          {detail.tickets.length ? (
            <section>
              <h3>پشتیبانی</h3>
              <ul className="admRows">
                {detail.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button type="button" onClick={() => onGo("support", { ticketId: ticket.id })}>
                      <span>{ticket.subject || (ticket.kind === "report" ? "گزارش" : "پیام")}</span>
                      <small>{STATUS_LABEL[ticket.status]} • {ago(ticket.last_message_at)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {detail.posts.length ? (
            <section>
              <h3>آخرین پست‌ها</h3>
              <ul className="admRows">
                {detail.posts.map((post) => (
                  <li key={post.id}>
                    <button type="button" onClick={() => onGo("content", { q: post.title })}>
                      <span>{post.title}{post.is_public ? "" : " • پنهان"}</span>
                      <small>{ago(post.created_at)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {detail.recentBookings.length ? (
            <section>
              <h3>آخرین رزروها</h3>
              <ul className="admRows">
                {detail.recentBookings.slice(0, 5).map((booking) => (
                  <li key={`${booking.kind}-${booking.id}`}><span>{booking.service || "—"} • {booking.booking_date} {booking.time}</span><small>{booking.status}</small></li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3>یادداشت خصوصی</h3>
            <p className="admMuted">فقط ادمین‌ها می‌بینند؛ مثلاً «با تلفن هویتش تأیید شد».</p>
            <Field label="یادداشت" hideLabel>{(props) => <textarea {...props} rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />}</Field>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => apiFetch(`/api/admin/users/${userId}/note`, { method: "POST", body: JSON.stringify({ note }) }), "یادداشت ذخیره شد.")}>ذخیرهٔ یادداشت</Button>
            {detail.note?.updated_at ? <small className="admMuted"> آخرین ویرایش: {fmtDate(detail.note.updated_at)}</small> : null}
          </section>
        </>
      ) : null}

      {pane === "edit" ? (
        <form className="admForm" onSubmit={(event) => { event.preventDefault(); run(() => apiFetch(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(form) }), "تغییرات ذخیره شد."); }}>
          <p className="admMuted">فقط وقتی لازم است عوض کن (مثلاً نام نامناسب). هر تغییر با مقدار قبلی‌اش در «گزارش فعالیت‌ها» ثبت می‌شود.</p>
          {[["name", "نام"], ["area", "منطقه"], ["service", "تخصص / خدمت"], ["email", "ایمیل"]].map(([key, label]) => (
            <Field key={key} label={label}>{(props) => <input {...props} type="text" dir={key === "email" ? "ltr" : undefined} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</Field>
          ))}
          <Field label="دربارهٔ او">{(props) => <textarea {...props} rows={4} maxLength={600} value={form.bio ?? ""} onChange={(event) => setForm({ ...form, bio: event.target.value })} />}</Field>
          <Button type="submit" disabled={busy}>ذخیرهٔ تغییرات</Button>
        </form>
      ) : null}

      {pane === "message" ? (
        <form className="admForm" onSubmit={(event) => { event.preventDefault(); run(() => apiFetch("/api/admin/support", { method: "POST", body: JSON.stringify({ userId, subject, message: text }) }), "پیام فرستاده شد. در بخش پشتیبانیِ خودش می‌بیند.", () => { setText(""); setSubject(""); }); }}>
          <p className="admMuted"><MessageSquarePlus size={14} aria-hidden="true" /> پیام در «پشتیبانی» همین کاربر می‌نشیند و اگر اعلان را روشن کرده باشد خبر هم می‌گیرد. جواب‌هایش در صندوق پشتیبانی می‌آید.</p>
          <Field label="عنوان (اختیاری)">{(props) => <input {...props} type="text" maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} />}</Field>
          <Field label="متن پیام">{(props) => <textarea {...props} rows={5} maxLength={2000} required value={text} onChange={(event) => setText(event.target.value)} />}</Field>
          <Button type="submit" disabled={busy || text.trim().length < 2}>ارسال پیام</Button>
        </form>
      ) : null}

      {pane === "actions" ? (
        detail.isAdmin ? (
          <p className="admMuted"><ShieldCheck size={14} aria-hidden="true" /> این حساب مدیر است؛ از اینجا مسدود، حذف یا رمزش عوض نمی‌شود.</p>
        ) : (
          <div className="admActions">
            <section>
              <h3>دسترسی</h3>
              <div className="admRowActions">
                {suspended ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => apiFetch(`/api/admin/users/${userId}/suspend`, { method: "POST", body: JSON.stringify({ suspended: false }) }), "مسدودی برداشته شد.")}><ShieldCheck size={15} aria-hidden="true" /> رفع مسدودی</Button>
                ) : (
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => window.confirm(`حساب «${user.name || user.phone}» مسدود شود؟ بلافاصله از اپ خارج می‌شود.`) && run(() => apiFetch(`/api/admin/users/${userId}/suspend`, { method: "POST", body: JSON.stringify({ suspended: true }) }), "حساب مسدود شد.")}><Ban size={15} aria-hidden="true" /> مسدودکردن</Button>
                )}
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => apiFetch(`/api/admin/users/${userId}/logout`, { method: "POST" }), "از همهٔ دستگاه‌ها خارج شد.")}><LogOut size={15} aria-hidden="true" /> خروج از همهٔ دستگاه‌ها</Button>
              </div>
            </section>
            <section>
              <h3>تعیین رمز جدید</h3>
              <p className="admMuted">برای کسی که رمزش را فراموش کرده. اول هویتش را (مثلاً با تماس) تأیید کن. رمز را خودت به او بگو.</p>
              <Field label="رمز جدید (حداقل ۸ کاراکتر)">{(props) => <input {...props} type="text" dir="ltr" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} />}</Field>
              <Button size="sm" variant="secondary" disabled={busy || password.length < 8} onClick={() => run(() => adminFetch(`/api/admin/users/${userId}/password`, { method: "POST", body: JSON.stringify({ newPassword: password }) }), "رمز تغییر کرد و از همهٔ دستگاه‌ها خارج شد.", () => setPassword(""))}><KeyRound size={15} aria-hidden="true" /> تعیین رمز</Button>
            </section>
            <section className="admDanger">
              <h3>حذف دائمی</h3>
              <p className="admMuted">حساب و داده‌هایش برای همیشه پاک می‌شود. برای تأیید، شمارهٔ <b dir="ltr">{user.phone}</b> را تایپ کن.</p>
              <Field label="شمارهٔ کاربر" hideLabel>{(props) => <input {...props} type="text" dir="ltr" placeholder={user.phone} value={confirmPhone} onChange={(event) => setConfirmPhone(event.target.value)} />}</Field>
              <Button size="sm" variant="danger" disabled={busy || confirmPhone.trim() !== user.phone} onClick={async () => {
                setBusy(true);
                const { ok, payload } = await adminFetch(`/api/admin/users/${userId}`, { method: "DELETE", body: JSON.stringify({ confirmPhone }) });
                setBusy(false);
                if (ok) { onChanged?.(); onGo("users", {}); } else setMessage(payload.error || "حذف نشد.");
              }}><Trash2 size={15} aria-hidden="true" /> حذف حساب و همهٔ داده‌هایش</Button>
            </section>
          </div>
        )
      ) : null}
    </div>
  );
}
