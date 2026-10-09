"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { Button } from "../components/ui";
import { AdminLogin } from "./AdminLogin";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { StepUpDialog } from "./StepUpDialog";
import { UsersTab } from "./UsersTab";
import { ContentTab } from "./ContentTab";
import { BookingsTab } from "./BookingsTab";
import { SecurityTab } from "./SecurityTab";
import { SupportTab } from "./SupportTab";
import { adminFetch } from "./adminFetch";
import { Dashboard } from "./Dashboard";
import { PageHead } from "./PageHead";
import { SECTIONS, tabInfo } from "./nav";
import { ACTION_LABEL, fmtDate, num } from "./format";

const THEME_KEY = "frfru_admin_theme";

/** Dark by default; the choice of light is remembered in this browser. */
export function AdminClient() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // storage can be blocked; stay on the default
    }
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // not essential
    }
  }
  return (
    <div className="admRoot" data-theme={theme}>
      <AdminApp theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}

function AdminApp({ theme, onToggleTheme }) {
  const [me, setMe] = useState(null);
  // Where we are and what was asked for there (e.g. "open this user"). `n` changes on every move so a page starts fresh.
  const [nav, setNav] = useState({ tab: "overview", params: {}, n: 0 });
  const go = useCallback((tab, params = {}) => setNav((prev) => ({ tab, params, n: prev.n + 1 })), []);

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
  if (!me.isAdmin) return <AdminLogin configured={me.configured !== false} setupKeyConfigured={me.setupKeyConfigured !== false} onDone={refresh} />;

  const { tab, params, n } = nav;
  const info = tabInfo(tab);
  return (
    <div className="admShell">
      <AdminSidebar sections={SECTIONS} active={tab} onSelect={(id) => go(id)} name={me.name} onLogout={logout} theme={theme} onToggleTheme={onToggleTheme} badges={{ support: me.openTickets || 0 }} />
      <main className="adm">
        <AdminTopbar onGo={go} />
        {tab === "overview" ? <Overview key={n} onGo={go} name={me.name} /> : null}
        {tab === "users" ? <UsersTab key={n} intent={params} onChanged={refresh} onGo={go} /> : null}
        {tab === "support" ? <SupportTab key={n} intent={params} onChanged={refresh} onGo={go} /> : null}
        {["content", "bookings", "resets", "security", "actions"].includes(tab) ? <PageHead title={info.label} desc={info.desc} /> : null}
        {tab === "content" ? <ContentTab key={n} intent={params} /> : null}
        {tab === "bookings" ? <BookingsTab key={n} /> : null}
        {tab === "resets" ? <Resets key={n} /> : null}
        {tab === "security" ? <SecurityTab key={n} /> : null}
        {tab === "actions" ? <Actions key={n} /> : null}
        <StepUpDialog />
      </main>
    </div>
  );
}

function Overview({ onGo, name }) {
  return (
    <>
      <Dashboard onGo={onGo} name={name} />
      <SmsCard />
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
        <p className="admMuted">پیامک هنوز وصل نیست؛ ثبت‌نام بدون کد انجام می‌شود و بازیابی رمز دستی است. برای فعال‌سازی، متغیرهای <span dir="ltr">FRFRU_SMS_PROVIDER</span> و کلید سرویس را در محیط اپ بگذار (راهنما: docs/OPERATIONS.md).</p>
      )}
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
    const { ok, payload } = await adminFetch(`/api/auth/password-reset-requests/${request.id}/resolve`, { method: "POST", body: JSON.stringify({ newPassword }) });
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
