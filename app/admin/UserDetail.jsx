"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, ExternalLink, KeyRound, LogOut, MessageSquarePlus, Phone, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Button, Field } from "../components/ui";
import { api } from "./adminFetch";
import { Avatar } from "./Avatar";
import { ACTION_LABEL, BOOKING_TONE, STATUS_LABEL, TYPE_LABEL, ago, fmtDate, fmtKey, fmtTime, num } from "./format";
import { CopyButton, ErrorNote, Loading, confirmAction, toastResult } from "./ui";
import { CannedReplies } from "./CannedReplies";
import { AccountBilling } from "./BillingAdmin";

const PANES = [
  ["overview", "نمای کلی"],
  ["history", "سابقه"],
  ["billing", "اشتراک"],
  ["edit", "ویرایش"],
  ["message", "پیام"],
  ["actions", "اقدام‌ها"]
];

/** A strong, readable password to read out on the phone: no look-alike characters (0/O, 1/l). */
export function makePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  return `${Array.from({ length: 4 }, () => pick(letters)).join("")}-${Array.from({ length: 4 }, () => pick(digits)).join("")}`;
}

/**
 * One account, in panes: overview (facts, set-up, activity, private note), history (everything admins did to it),
 * subscription (salons and artists: state, payments, add days), edit (fix the profile), message (talk to them in their
 * support inbox) and actions (suspend, sign out, password, delete).
 */
export function UserDetail({ userId, onChanged, onGo, onClose }) {
  const [detail, setDetail] = useState(null);
  const [pane, setPane] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    const result = await api.get(`/api/admin/users/${userId}`);
    if (!result.ok) return setDetail({ error: result.payload?.error || "بارگذاری نشد." });
    setDetail(result.payload.data);
    const { user } = result.payload.data;
    setForm({ name: user.name || "", area: user.area || "", service: user.service || "", email: user.email || "" });
    setNote(result.payload.data.note?.note || "");
  }, [userId]);
  useEffect(() => {
    setDetail(null);
    setPane("overview");
    load();
  }, [load]);

  async function run(call, done, after) {
    setBusy(true);
    const result = await call();
    setBusy(false);
    if (toastResult(result, done)) {
      await load();
      onChanged?.();
      after?.();
    }
    return result.ok;
  }

  if (!detail) return <Loading />;
  if (detail.error) return <ErrorNote error={detail.error} onRetry={load} />;
  const { user, counts, setup } = detail;
  const suspended = Boolean(user.suspended_at);
  const profileUrl = user.type === "salon" ? `/salons/${user.id}` : user.type === "artist" ? `/artists/${user.id}` : null;
  const lastSuspend = detail.history.find((row) => row.action === "suspend");

  async function suspend() {
    const answer = await confirmAction({
      title: `حساب «${user.name || user.phone}» مسدود شود؟`,
      body: "بلافاصله از اپ خارج می‌شود و تا رفع مسدودی نمی‌تواند وارد شود.",
      danger: true,
      confirmLabel: "مسدود شود",
      reason: { label: "دلیل (در سابقه می‌ماند)", placeholder: "مثلاً: اسپم، شکایت چند مشتری" }
    });
    if (answer.ok) run(() => api.post(`/api/admin/users/${userId}/suspend`, { suspended: true, reason: answer.reason }), "حساب مسدود شد.");
  }

  async function remove() {
    const answer = await confirmAction({
      title: "حذف دائمی حساب",
      body: "حساب و همهٔ داده‌هایش (پست‌ها، خدمت‌ها، رزروهای خودش) برای همیشه پاک می‌شود و برگشت ندارد.",
      danger: true,
      confirmLabel: "حذف برای همیشه",
      typeToConfirm: user.phone
    });
    if (!answer.ok) return;
    setBusy(true);
    const result = await api.del(`/api/admin/users/${userId}`, { confirmPhone: user.phone });
    setBusy(false);
    if (toastResult(result, "حساب حذف شد.")) {
      onChanged?.();
      onClose?.();
    }
  }

  return (
    <div className="admDetail">
      <header className="admDetailHead">
        <Avatar name={user.name} phone={user.phone} />
        <div>
          <h2>{user.name || "بدون نام"}</h2>
          <p className="admMuted admDetailSub">
            <span className={`admPill is-${user.type}`}>{TYPE_LABEL[user.type] || user.type}</span>
            <span dir="ltr">{user.phone}</span>
            <CopyButton text={user.phone} label="کپی شماره" />
          </p>
        </div>
        <span className={`admDot${suspended ? " is-off" : ""}`}>{suspended ? "مسدود" : "فعال"}</span>
      </header>

      <div className="admDetailTools">
        <a className="admChipLink" href={`tel:${user.phone}`}><Phone size={15} aria-hidden="true" /> تماس</a>
        {profileUrl ? <a className="admChipLink" href={profileUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /> صفحهٔ عمومی</a> : null}
        <button type="button" className="admChipLink" onClick={() => setPane("message")}><MessageSquarePlus size={15} aria-hidden="true" /> پیام</button>
        <button type="button" className="admChipLink" onClick={() => onGo("bookings", { q: user.phone })}>رزروهایش</button>
        {user.type !== "client" ? <button type="button" className="admChipLink" onClick={() => onGo("content", { q: user.phone })}>پست‌هایش</button> : null}
      </div>

      {suspended ? (
        <p className="admError admBanner" role="status">
          <Ban size={16} aria-hidden="true" /> از {ago(user.suspended_at)} مسدود است{lastSuspend?.detail ? ` • ${lastSuspend.detail}` : ""}.
        </p>
      ) : null}

      <div className="admPanes" role="tablist" aria-label="بخش‌های این کاربر">
        {PANES.filter(([id]) => id !== "billing" || user.type !== "client").map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={pane === id} className={pane === id ? "is-on" : ""} onClick={() => setPane(id)}>{label}</button>
        ))}
      </div>

      {pane === "overview" ? (
        <>
          <div className="admMiniStats">
            <div><b>{num(counts.posts)}</b><small>پست</small></div>
            <div><b>{num(counts.followers)}</b><small>دنبال‌کننده</small></div>
            <div><b>{num(counts.bookings)}</b><small>رزرو</small></div>
          </div>
          <ul className="admFacts">
            <li><span>عضویت</span><b>{fmtDate(user.created_at)}</b></li>
            <li><span>آخرین بازدید</span><b>{user.last_seen_at ? ago(user.last_seen_at) : "—"}</b></li>
            <li><span>منطقه و خدمت</span><b>{[user.area, user.service].filter(Boolean).join(" • ") || "—"}</b></li>
            {user.email ? <li><span>ایمیل</span><b dir="ltr">{user.email}</b></li> : null}
            {user.type !== "client" ? <li><span>لغو توسط سالن</span><b>{num(user.provider_cancel_count || 0)} بار (نوبت تأییدشده را خودش لغو کرده؛ فقط شمارش)</b></li> : null}
            <li><span>نشست فعال</span><b>{num(detail.activeSessions)} دستگاه</b></li>
            <li><span>اعلان گوشی</span><b>{detail.pushDevices ? `روشن روی ${num(detail.pushDevices)} دستگاه` : "خاموش"}</b></li>
          </ul>

          {setup ? (
            <section className="admSetup">
              <h3><Sparkles size={15} aria-hidden="true" /> آمادگی برای رزرو</h3>
              <ul>
                <li className={setup.services ? "is-ok" : "is-missing"}>{setup.services ? `${num(setup.services)} خدمت` : "هنوز خدمتی ثبت نکرده (کسی نمی‌تواند رزرو کند)"}</li>
                <li className={setup.open_days ? "is-ok" : "is-missing"}>{setup.open_days ? `${num(setup.open_days)} روز باز در هفته` : "روز کاری فعالی ندارد"}</li>
                <li className={user.has_avatar ? "is-ok" : "is-missing"}>{user.has_avatar ? "عکس پروفایل دارد" : "عکس پروفایل ندارد"}</li>
                {user.type === "salon" ? <li className={setup.staff ? "is-ok" : "is-missing"}>{setup.staff ? `${num(setup.staff)} نفر پرسنل` : "پرسنلی ثبت نکرده"}</li> : null}
              </ul>
            </section>
          ) : null}

          {detail.tickets.length ? (
            <section>
              <h3>پشتیبانی</h3>
              <ul className="admRows">
                {detail.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button type="button" onClick={() => onGo("support", { id: ticket.id })}>
                      <span>{ticket.subject || (ticket.kind === "report" ? "گزارش" : "پیام")}</span>
                      <small>{STATUS_LABEL[ticket.status]} • {ago(ticket.last_message_at)}</small>
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
                {detail.recentBookings.slice(0, 6).map((booking) => (
                  <li key={`${booking.kind}-${booking.id}`}>
                    <button type="button" onClick={() => onGo("bookings", { kind: booking.kind, id: booking.id })}>
                      <span>{booking.service || "—"} • {fmtKey(booking.booking_date)} {fmtTime(booking.time)}</span>
                      <span className={`admTone is-${BOOKING_TONE[booking.status] || "muted"}`}>{booking.status}</span>
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

          <section>
            <h3>یادداشت خصوصی</h3>
            <p className="admMuted">فقط مدیرها می‌بینند؛ مثلاً «با تلفن هویتش تأیید شد».</p>
            <Field label="یادداشت" hideLabel>{(props) => <textarea {...props} rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />}</Field>
            <div className="admRowActions">
              <Button size="sm" variant="secondary" disabled={busy || note === (detail.note?.note || "")} onClick={() => run(() => api.post(`/api/admin/users/${userId}/note`, { note }), "یادداشت ذخیره شد.")}>ذخیرهٔ یادداشت</Button>
              {detail.note?.updated_at ? <small className="admMuted">آخرین ویرایش: {fmtDate(detail.note.updated_at)}</small> : null}
            </div>
          </section>
        </>
      ) : null}

      {pane === "billing" && user.type !== "client" ? <AccountBilling userId={user.id} name={user.name} onGo={onGo} /> : null}

      {pane === "history" ? (
        detail.history.length ? (
          <ul className="admTimeline">
            {detail.history.map((row) => (
              <li key={row.id}>
                <b>{ACTION_LABEL[row.action] || row.action}</b>
                {row.detail ? <p>{row.detail}</p> : null}
                <small>{fmtDate(row.created_at)} • <span dir="ltr">{row.admin_label}</span></small>
              </li>
            ))}
          </ul>
        ) : <p className="admMuted">هنوز هیچ مدیری کاری روی این حساب انجام نداده.</p>
      ) : null}

      {pane === "edit" ? (
        <form className="admForm" onSubmit={(event) => { event.preventDefault(); run(() => api.patch(`/api/admin/users/${userId}`, form), "تغییرات ذخیره شد."); }}>
          <p className="admMuted">فقط وقتی لازم است عوض کن (مثلاً نام نامناسب). هر تغییر با مقدار قبلی‌اش در سابقه ثبت می‌شود.</p>
          {[["name", "نام"], ["area", "منطقه"], ["service", "تخصص / خدمت"], ["email", "ایمیل"]].map(([key, label]) => (
            <Field key={key} label={label}>{(props) => <input {...props} type="text" dir={key === "email" ? "ltr" : undefined} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</Field>
          ))}
          <Button type="submit" disabled={busy}>ذخیرهٔ تغییرات</Button>
        </form>
      ) : null}

      {pane === "message" ? (
        <form className="admForm" onSubmit={(event) => { event.preventDefault(); run(() => api.post("/api/admin/support", { userId, subject, message: text }), "پیام فرستاده شد. در پشتیبانیِ خودش می‌بیند.", () => { setText(""); setSubject(""); }); }}>
          <p className="admMuted"><MessageSquarePlus size={14} aria-hidden="true" /> پیام در «پشتیبانی» همین کاربر می‌نشیند و اگر اعلان را روشن کرده باشد خبر هم می‌گیرد. جواب‌هایش در صندوق پشتیبانی می‌آید.</p>
          <Field label="عنوان (اختیاری)">{(props) => <input {...props} type="text" maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} />}</Field>
          <Field label="متن پیام">{(props) => <textarea {...props} rows={5} maxLength={2000} required value={text} onChange={(event) => setText(event.target.value)} />}</Field>
          <CannedReplies onPick={(body) => setText((prev) => (prev ? `${prev}\n${body}` : body))} />
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
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api.post(`/api/admin/users/${userId}/suspend`, { suspended: false }), "مسدودی برداشته شد.")}><ShieldCheck size={15} aria-hidden="true" /> رفع مسدودی</Button>
                ) : (
                  <Button size="sm" variant="danger" disabled={busy} onClick={suspend}><Ban size={15} aria-hidden="true" /> مسدودکردن</Button>
                )}
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api.post(`/api/admin/users/${userId}/logout`), "از همهٔ دستگاه‌ها خارج شد.")}><LogOut size={15} aria-hidden="true" /> خروج از همهٔ دستگاه‌ها</Button>
              </div>
            </section>
            <section>
              <h3>تعیین رمز جدید</h3>
              <p className="admMuted">برای کسی که رمزش را فراموش کرده. اول هویتش را (مثلاً با تماس) تأیید کن، بعد رمز را خودت به او بگو.</p>
              <div className="admPasswordRow">
                <Field label="رمز جدید (حداقل ۸ کاراکتر)">{(props) => <input {...props} type="text" dir="ltr" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} />}</Field>
                <Button size="sm" variant="ghost" onClick={() => setPassword(makePassword())}>رمز تصادفی</Button>
                {password ? <CopyButton text={password} label="کپی رمز" /> : null}
              </div>
              <Button size="sm" variant="secondary" disabled={busy || password.length < 8} onClick={() => run(() => api.post(`/api/admin/users/${userId}/password`, { newPassword: password }), "رمز تغییر کرد و از همهٔ دستگاه‌ها خارج شد.", () => setPassword(""))}><KeyRound size={15} aria-hidden="true" /> تعیین رمز</Button>
            </section>
            <section className="admDanger">
              <h3>حذف دائمی</h3>
              <p className="admMuted">حساب و داده‌هایش برای همیشه پاک می‌شود. پیش از آن معمولاً «مسدودکردن» کافی است.</p>
              <Button size="sm" variant="danger" disabled={busy} onClick={remove}><Trash2 size={15} aria-hidden="true" /> حذف حساب و همهٔ داده‌هایش</Button>
            </section>
          </div>
        )
      ) : null}
    </div>
  );
}
