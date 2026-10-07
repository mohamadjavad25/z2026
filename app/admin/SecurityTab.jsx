"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../shared/api/client";
import { adminFetch } from "./adminFetch";
import { Button } from "../components/ui";
import { fmtDate } from "./format";

const EVENT_LABEL = {
  login: "ورود موفق",
  login_failed: "ورود ناموفق",
  login_blocked: "ورود مسدود (تلاش زیاد)",
  enroll: "راه‌اندازی Authenticator",
  enroll_failed: "راه‌اندازی ناموفق",
  stepup: "تأیید دوباره موفق",
  stepup_failed: "تأیید دوباره ناموفق",
  revoke_sessions: "پایان نشست‌ها",
  reset_authenticator: "ریست Authenticator"
};

/** Who is signed in to the admin panel right now, and every recent sign-in attempt (with IP). */
export function SecurityTab() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const { ok, payload } = await apiFetch("/api/admin/security");
    if (ok) setData(payload.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revoke(session) {
    if (!window.confirm(`همهٔ نشست‌های ${session.phone} بسته شود؟`)) return;
    const { ok, payload } = await adminFetch("/api/admin/security/revoke", { method: "POST", body: JSON.stringify({ userId: session.user_id }) });
    setMessage(ok ? "نشست‌ها بسته شد." : payload.error || "انجام نشد.");
    if (ok) load();
  }

  async function resetAuthenticator(account) {
    if (!window.confirm(`Authenticator ${account.phone} پاک شود؟ همین الان از پنل خارج می‌شود و باید دوباره «راه‌اندازی اولیه» را انجام دهد.`)) return;
    const { ok, payload } = await adminFetch("/api/admin/security/reset-authenticator", { method: "POST", body: JSON.stringify({ userId: account.id }) });
    setMessage(ok ? "Authenticator پاک شد؛ حالا می‌تواند دوباره راه‌اندازی کند." : payload.error || "انجام نشد.");
    if (ok) load();
  }

  if (!data) return <p className="admMuted">در حال بارگذاری…</p>;
  return (
    <>
      <section className="admCard">
        <h2>حساب‌های مدیر</h2>
        <p className="admMuted">این شماره‌ها در <span dir="ltr">ZIBABAN_ADMIN_PHONES</span> تعریف شده‌اند. اگر مدیری گوشی‌اش را گم کرد، Authenticatorش را اینجا پاک کن تا دوباره راه‌اندازی کند (به رمز حسابش و کلید راه‌اندازی نیاز دارد).</p>
        <ul className="admList">
          {data.accounts.map((account) => (
            <li key={account.phone}>
              <span>
                <b dir="ltr">{account.phone}</b> {account.id === data.me ? "(تو)" : ""}
                <br />
                <small>{!account.registered ? "هنوز در سایت ثبت‌نام نکرده" : account.authenticator ? `Authenticator فعال${account.online ? " • الان وارد است" : ""}` : "Authenticator هنوز راه‌اندازی نشده"}</small>
              </span>
              {account.registered && account.id !== data.me && account.authenticator ? <Button size="sm" variant="danger" onClick={() => resetAuthenticator(account)}>ریست Authenticator</Button> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="admCard">
        <h2>نشست‌های فعال مدیریت</h2>
        {message ? <p className="admNote" role="status">{message}</p> : null}
        <ul className="admList">
          {data.sessions.map((session) => (
            <li key={session.user_id}>
              <span><b dir="ltr">{session.phone}</b> {session.user_id === data.me ? "(تو)" : ""}<br /><small>ورود: {fmtDate(session.created_at)} • آخرین فعالیت: {fmtDate(session.last_seen_at)}</small></span>
              <Button size="sm" variant="danger" onClick={() => revoke(session)}>بستن نشست</Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="admCard">
        <h2>رویدادهای ورود</h2>
        <ul className="admList">
          {data.events.map((event) => (
            <li key={event.id}>
              <span>{EVENT_LABEL[event.action] || event.action} — <span dir="ltr">{event.admin_label || "—"}</span><br /><small dir="ltr">{event.detail}</small></span>
              <small>{fmtDate(event.created_at)}</small>
            </li>
          ))}
          {!data.events.length ? <li className="admMuted">رویدادی نیست.</li> : null}
        </ul>
      </section>
    </>
  );
}
