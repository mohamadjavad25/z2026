"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarDays, ExternalLink, FileText, KeyRound, LogOut, MessageSquarePlus, MoreHorizontal, Pencil, Phone, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Button, Field } from "../components/ui";
import { api } from "./adminFetch";
import { Avatar } from "./Avatar";
import { ACTION_LABEL, BOOKING_TONE, STATUS_LABEL, TYPE_LABEL, ago, fmtDate, fmtKey, fmtTime, num } from "./format";
import { CopyButton, ErrorNote, Loading, confirmAction, toastResult } from "./ui";
import { CannedReplies } from "./CannedReplies";
import { AccountBilling } from "./BillingAdmin";
import { ActionMenu, Dialog } from "./ActionMenu";

const PANES = [
  ["overview", "خلاصه"],
  ["history", "فعالیت"],
  ["billing", "اشتراک"]
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
  const [dialog, setDialog] = useState(null);

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
    setDialog(null);
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

  async function unsuspend() {
    run(() => api.post(`/api/admin/users/${userId}/suspend`, { suspended: false }), "مسدودی برداشته شد.");
  }

  async function logoutAll() {
    run(() => api.post(`/api/admin/users/${userId}/logout`), "از همهٔ دستگاه‌ها خارج شد.");
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

  /* Every operation on this account lives in this one list; add a line here and it shows in the «اقدام‌ها» sheet. */
  const menuItems = detail.isAdmin ? [] : [
    { group: "مدیریت حساب", icon: Pencil, label: "ویرایش نام و مشخصات", run: () => setDialog("edit"), keep: true },
    { group: "مدیریت حساب", icon: KeyRound, label: "تعیین رمز جدید", run: () => setDialog("password"), keep: true },
    { group: "مدیریت حساب", icon: LogOut, label: "خروج از همهٔ دستگاه‌ها", run: logoutAll },
    { group: "رفتن به", icon: CalendarDays, label: "رزروهایش", run: () => onGo("bookings", { q: user.phone }) },
    ...(user.type !== "client" ? [{ group: "رفتن به", icon: FileText, label: "پست‌هایش", run: () => onGo("content", { q: user.phone }) }] : []),
    ...(profileUrl ? [{ group: "رفتن به", icon: ExternalLink, label: "صفحهٔ عمومی", href: profileUrl }] : []),
    suspended
      ? { group: "خطرناک", icon: ShieldCheck, label: "رفع مسدودی", run: unsuspend }
      : { group: "خطرناک", icon: Ban, label: "مسدود کردن", danger: true, run: suspend },
    { group: "خطرناک", icon: Trash2, label: "حذف دائمی حساب", danger: true, run: remove }
  ];

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
        <button type="button" className="admChipLink" onClick={() => setDialog("message")}><MessageSquarePlus size={15} aria-hidden="true" /> پیام</button>
        <button type="button" className="admChipLink is-primary" onClick={() => setDialog("menu")}><MoreHorizontal size={15} aria-hidden="true" /> اقدام‌ها</button>
      </div>

      {suspended ? (
        <p className="admError admBanner" role="status">
          <Ban size={16} aria-hidden="true" /> از {ago(user.suspended_at)} مسدود است{lastSuspend?.detail ? ` • ${lastSuspend.detail}` : ""}.
          {!detail.isAdmin ? <button type="button" className="admLink" disabled={busy} onClick={unsuspend}>رفع مسدودی</button> : null}
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

          {[["report", "گزارش‌ها دربارهٔ این حساب یا از طرف او"], ["other", "پشتیبانی"]].map(([which, title]) => {
            const rows = detail.tickets.filter((ticket) => (which === "report") === (ticket.kind === "report"));
            return rows.length ? (
            <section key={which}>
              <h3>{title} ({num(rows.length)})</h3>
              <ul className="admRows">
                {rows.map((ticket) => (
                  <li key={ticket.id}>
                    <button type="button" onClick={() => onGo("support", { id: ticket.id })}>
                      <span>{ticket.subject || (ticket.kind === "report" ? "گزارش" : "پیام")}</span>
                      <small>{STATUS_LABEL[ticket.status]} • {ago(ticket.last_message_at)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            ) : null;
          })}
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

      {dialog === "menu" ? <ActionMenu items={menuItems} onClose={() => setDialog(null)} /> : null}
      {dialog === "edit" ? (
        <Dialog title="ویرایش مشخصات" onClose={() => setDialog(null)} onSubmit={() => run(() => api.patch(`/api/admin/users/${userId}`, form), "تغییرات ذخیره شد.", () => setDialog(null))} submitLabel="ذخیره" busy={busy}>
          <p className="admMuted">فقط وقتی لازم است عوض کن (مثلاً نام نامناسب). هر تغییر با مقدار قبلی‌اش در سابقه ثبت می‌شود.</p>
          {[["name", "نام"], ["area", "منطقه"], ["service", "تخصص / خدمت"], ["email", "ایمیل"]].map(([key, label]) => (
            <Field key={key} label={label}>{(props) => <input {...props} type="text" dir={key === "email" ? "ltr" : undefined} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</Field>
          ))}
        </Dialog>
      ) : null}
      {dialog === "message" ? (
        <Dialog title={`پیام به ${user.name || user.phone}`} onClose={() => setDialog(null)} submitLabel="ارسال پیام" busy={busy} disabled={text.trim().length < 2}
          onSubmit={() => run(() => api.post("/api/admin/support", { userId, subject, message: text }), "پیام فرستاده شد. در پشتیبانیِ خودش می‌بیند.", () => { setText(""); setSubject(""); setDialog(null); })}>
          <p className="admMuted">پیام در «پشتیبانی» همین کاربر می‌نشیند و اگر اعلان را روشن کرده باشد خبر هم می‌گیرد. جواب‌هایش در صندوق پشتیبانی می‌آید.</p>
          <Field label="عنوان (اختیاری)">{(props) => <input {...props} type="text" maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} />}</Field>
          <Field label="متن پیام">{(props) => <textarea {...props} rows={5} maxLength={2000} required value={text} onChange={(event) => setText(event.target.value)} />}</Field>
          <CannedReplies onPick={(body) => setText((prev) => (prev ? `${prev}\n${body}` : body))} />
        </Dialog>
      ) : null}
      {dialog === "password" ? (
        <Dialog title="تعیین رمز جدید" onClose={() => setDialog(null)} submitLabel="تعیین رمز" busy={busy} disabled={password.length < 8}
          onSubmit={() => run(() => api.post(`/api/admin/users/${userId}/password`, { newPassword: password }), "رمز تغییر کرد و از همهٔ دستگاه‌ها خارج شد.", () => { setPassword(""); setDialog(null); })}>
          <p className="admMuted">برای کسی که رمزش را فراموش کرده. اول هویتش را (مثلاً با تماس) تأیید کن، بعد رمز را خودت به او بگو.</p>
          <div className="admPasswordRow">
            <Field label="رمز جدید (حداقل ۸ کاراکتر)">{(props) => <input {...props} type="text" dir="ltr" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} />}</Field>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPassword(makePassword())}>رمز تصادفی</Button>
            {password ? <CopyButton text={password} label="کپی رمز" /> : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
