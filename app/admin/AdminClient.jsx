"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { toPersianDigits } from "../shared/lib/digits";
import { Button, Chip, Field } from "../components/ui";
import { AdminLogin } from "./AdminLogin";

const TYPE_LABEL = { client: "مشتری", artist: "آرتیست", salon: "سالن" };
const ACTION_LABEL = {
  suspend: "مسدود شد",
  unsuspend: "رفع مسدودی",
  resolve_password_reset: "رمز بازنشانی شد",
  login: "ورود مدیر",
  login_failed: "ورود ناموفق",
  login_blocked: "ورود مسدود (تلاش زیاد)",
  enroll: "راه‌اندازی Authenticator",
  enroll_failed: "راه‌اندازی ناموفق"
};
const TABS = [
  { id: "overview", label: "نمای کلی" },
  { id: "users", label: "کاربران" },
  { id: "resets", label: "بازیابی رمز" },
  { id: "actions", label: "گزارش عملیات" }
];
const PAGE = 25;

const fmtDate = (value) => (value ? toPersianDigits(new Intl.DateTimeFormat("fa-IR-u-nu-latn", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value))) : "—");
const num = (value) => toPersianDigits(Number(value || 0).toLocaleString("en-US").replace(/,/g, "٬"));

export function AdminClient() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("overview");

  const refresh = useCallback(() => apiFetch("/api/admin/me").then(({ payload }) => setMe(payload.data || { isAdmin: false })), []);

  useEffect(() => {
    refresh();
    // A session ends after 30 idle minutes: re-check when the tab comes back and once a minute, so the login form appears instead of silent errors.
    const timer = setInterval(refresh, 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function logout() {
    await apiFetch("/api/admin/auth/logout", { method: "POST" });
    setMe({ isAdmin: false, configured: true });
  }

  if (!me) return <main className="adm"><p className="admMuted">در حال بارگذاری…</p></main>;
  if (!me.isAdmin) return <AdminLogin configured={me.configured !== false} onDone={refresh} />;

  return (
    <main className="adm">
      <header className="admHead">
        <h1>مدیریت زیبابان</h1>
        <span className="admMuted">{me.name}</span>
        <button type="button" className="admLink" onClick={logout}>خروج</button>
      </header>
      <nav className="admTabs" role="tablist" aria-label="بخش‌های مدیریت">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-on" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      {tab === "overview" ? <Overview /> : null}
      {tab === "users" ? <Users /> : null}
      {tab === "resets" ? <Resets /> : null}
      {tab === "actions" ? <Actions /> : null}
    </main>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="admStat">
      <small>{label}</small>
      <b>{value}</b>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    apiFetch("/api/admin/stats").then(({ ok, payload }) => (ok ? setData(payload.data) : setFailed(true)));
  }, []);
  if (failed) return <p className="admError" role="alert">بارگذاری آمار انجام نشد.</p>;
  if (!data) return <p className="admMuted">در حال بارگذاری…</p>;
  const max = Math.max(1, ...data.signupsByDay.map((day) => day.count));
  const statuses = Object.entries(data.bookingsLast30Days);
  return (
    <>
      <div className="admGrid">
        <Stat label="کل کاربران" value={num(data.users.total)} hint={`${num(data.users.byType.client || 0)} مشتری ، ${num(data.users.byType.artist || 0)} آرتیست ، ${num(data.users.byType.salon || 0)} سالن`} />
        <Stat label="رزرو امروز" value={num(data.bookingsCreatedToday)} />
        <Stat label="درخواست بازیابی رمز" value={num(data.pendingPasswordResets)} hint={data.pendingPasswordResets ? "منتظر پیگیری" : "چیزی منتظر نیست"} />
        <Stat label="یادآوری ارسال‌شده (۷ روز)" value={num(data.remindersSentLast7Days)} />
        <Stat label="حساب‌های مسدود" value={num(data.users.suspended)} />
      </div>
      <SmsCard />
      <section className="admCard">
        <h2>ثبت‌نام جدید در ۱۴ روز گذشته</h2>
        <div className="admBars" role="img" aria-label={`ثبت‌نام روزانه؛ بیشترین ${num(max)} نفر در روز`}>
          {data.signupsByDay.map((day) => (
            <div key={day.day} className="admBar" title={`${day.day}: ${day.count}`}>
              <i style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }} />
              <small>{toPersianDigits(day.day.slice(8))}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="admCard">
        <h2>وضعیت رزروها در ۳۰ روز گذشته</h2>
        {statuses.length ? (
          <ul className="admList">
            {statuses.map(([status, count]) => (
              <li key={status}><span>{status}</span><b>{num(count)}</b></li>
            ))}
          </ul>
        ) : <p className="admMuted">رزروی ثبت نشده.</p>}
      </section>
    </>
  );
}

function SmsCard() {
  const [sms, setSms] = useState(null);
  useEffect(() => {
    apiFetch("/api/admin/sms").then(({ ok, payload }) => ok && setSms(payload.data));
  }, []);
  if (!sms) return null;
  const on = Boolean(sms.provider);
  return (
    <section className="admCard">
      <h2>پیامک و تأیید شماره</h2>
      {on ? (
        <ul className="admList">
          <li><span>سرویس پیامک</span><b dir="ltr">{sms.provider}</b></li>
          <li><span>تأیید شماره هنگام ثبت‌نام</span><b>{sms.config.required ? "اجباری" : "اختیاری"}</b></li>
          <li><span>ارسال موفق در ۲۴ ساعت</span><b>{num(sms.sent24h)}</b></li>
          <li><span>ارسال ناموفق در ۲۴ ساعت</span><b>{num(sms.failed24h)}</b></li>
          {sms.lastFailure ? <li><span>آخرین خطا</span><small dir="ltr">{sms.lastFailure.detail}</small></li> : null}
        </ul>
      ) : (
        <p className="admMuted">پیامک هنوز وصل نیست؛ ثبت‌نام بدون کد انجام می‌شود و بازیابی رمز دستی است. برای فعال‌سازی، متغیرهای <span dir="ltr">ZIBABAN_SMS_PROVIDER</span> و کلید سرویس را در محیط اپ بگذار (راهنما: docs/OPERATIONS.md).</p>
      )}
    </section>
  );
}

function Users() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ q, type, offset: String(offset), limit: String(PAGE) });
    const { ok, payload } = await apiFetch(`/api/admin/users?${qs}`);
    if (ok) setData(payload.data);
    setLoading(false);
  }, [q, type, offset]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function toggleSuspend(user) {
    const suspend = !user.suspended_at;
    if (suspend && !window.confirm(`حساب «${user.name || user.phone}» مسدود شود؟ بلافاصله از اپ خارج می‌شود.`)) return;
    setBusyId(user.id);
    const { ok, payload } = await apiFetch(`/api/admin/users/${user.id}/suspend`, { method: "POST", body: JSON.stringify({ suspended: suspend }) });
    setBusyId(null);
    setMessage(ok ? (suspend ? "حساب مسدود شد." : "مسدودی برداشته شد.") : payload.error || "انجام نشد.");
    if (ok) load();
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;
  return (
    <section className="admCard">
      <div className="admFilters">
        <Field label="جستجوی نام یا شماره" hideLabel>
          {(props) => <input {...props} type="search" placeholder="جستجوی نام یا شماره…" value={q} onChange={(event) => { setQ(event.target.value); setOffset(0); }} />}
        </Field>
        <div className="admChips" role="group" aria-label="نوع حساب">
          {[["", "همه"], ["client", "مشتری"], ["artist", "آرتیست"], ["salon", "سالن"]].map(([value, label]) => (
            <Chip key={value || "all"} selected={type === value} onClick={() => { setType(value); setOffset(0); }}>{label}</Chip>
          ))}
        </div>
      </div>
      {message ? <p className="admNote" role="status">{message}</p> : null}
      <div className="admTableWrap">
        <table className="admTable">
          <thead>
            <tr><th>نام</th><th>نوع</th><th>شماره</th><th>عضویت</th><th>آخرین بازدید</th><th /></tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user.id} className={user.suspended_at ? "is-suspended" : ""}>
                <td>{user.name || "—"}{user.suspended_at ? <em> • مسدود</em> : null}</td>
                <td>{TYPE_LABEL[user.type] || user.type}</td>
                <td dir="ltr">{user.phone}</td>
                <td>{fmtDate(user.created_at)}</td>
                <td>{fmtDate(user.last_seen_at)}</td>
                <td>
                  <Button size="sm" variant={user.suspended_at ? "secondary" : "danger"} loading={busyId === user.id} loadingLabel="…" onClick={() => toggleSuspend(user)}>
                    {user.suspended_at ? "رفع مسدودی" : "مسدود"}
                  </Button>
                </td>
              </tr>
            ))}
            {!data.users.length && !loading ? <tr><td colSpan={6} className="admMuted">کاربری پیدا نشد.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <footer className="admPager">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>قبلی</Button>
        <span>{num(data.total)} کاربر • صفحهٔ {num(page)} از {num(pages)}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}>بعدی</Button>
      </footer>
    </section>
  );
}

function Resets() {
  const [requests, setRequests] = useState(null);
  const [passwords, setPasswords] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const { ok, payload } = await apiFetch("/api/auth/password-reset-requests");
    setRequests(ok ? payload.data.requests : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function resolve(request) {
    const newPassword = String(passwords[request.id] || "");
    if (newPassword.length < 8) { setMessage("رمز جدید باید حداقل ۸ کاراکتر باشد."); return; }
    setBusyId(request.id);
    const { ok, payload } = await apiFetch(`/api/auth/password-reset-requests/${request.id}/resolve`, { method: "POST", body: JSON.stringify({ newPassword }) });
    setBusyId(null);
    setMessage(ok ? "رمز بازنشانی شد؛ رمز جدید را به کاربر بگو." : payload.error || "انجام نشد.");
    if (ok) load();
  }

  if (!requests) return <p className="admMuted">در حال بارگذاری…</p>;
  return (
    <section className="admCard">
      <h2>درخواست‌های بازیابی رمز</h2>
      <p className="admMuted">با شمارهٔ کاربر تماس بگیر و هویتش را تأیید کن، بعد رمز جدید را اینجا بگذار. (بازیابی خودکار با پیامک، در مرحلهٔ بعد.)</p>
      {message ? <p className="admNote" role="status">{message}</p> : null}
      {requests.length ? (
        <ul className="admReqs">
          {requests.map((request) => (
            <li key={request.id}>
              <div><b dir="ltr">{request.phone}</b><small>{fmtDate(request.created_at)}{request.note ? ` • ${request.note}` : ""}</small></div>
              <input aria-label={`رمز جدید برای ${request.phone}`} type="text" dir="ltr" placeholder="رمز جدید (حداقل ۸)" value={passwords[request.id] || ""} onChange={(event) => setPasswords({ ...passwords, [request.id]: event.target.value })} />
              <Button size="sm" loading={busyId === request.id} loadingLabel="…" onClick={() => resolve(request)}>بازنشانی</Button>
            </li>
          ))}
        </ul>
      ) : <p className="admMuted">درخواستی منتظر نیست.</p>}
    </section>
  );
}

function Actions() {
  const [actions, setActions] = useState(null);
  useEffect(() => {
    apiFetch("/api/admin/actions").then(({ ok, payload }) => setActions(ok ? payload.data.actions : []));
  }, []);
  if (!actions) return <p className="admMuted">در حال بارگذاری…</p>;
  return (
    <section className="admCard">
      <h2>آخرین عملیات مدیریتی</h2>
      {actions.length ? (
        <ul className="admList">
          {actions.map((item) => (
            <li key={item.id}>
              <span>{ACTION_LABEL[item.action] || item.action} — {item.target_name || item.target_phone || `#${item.target_user_id}`}</span>
              <small>{fmtDate(item.created_at)} • {item.admin_label}</small>
            </li>
          ))}
        </ul>
      ) : <p className="admMuted">هنوز عملیاتی ثبت نشده.</p>}
    </section>
  );
}
