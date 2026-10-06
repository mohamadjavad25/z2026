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
  revoke_sessions: "پایان نشست‌ها"
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

  if (!data) return <p className="admMuted">در حال بارگذاری…</p>;
  return (
    <>
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
