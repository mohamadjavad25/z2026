"use client";

import { KeyRound, LogOut, ShieldCheck, ShieldAlert, Smartphone } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { ACTION_LABEL, ago, fmtDate, num } from "./format";
import { PageHead } from "./PageHead";
import { Card, ErrorNote, Loading, confirmAction, toastResult, useAdminData } from "./ui";

const BAD = new Set(["login_failed", "login_blocked", "enroll_failed", "stepup_failed"]);

/** Who can sign in to the panel, who is signed in right now, and every recent sign-in attempt (with IP). */
export function SecurityTab() {
  const { data, error, reload } = useAdminData("/api/admin/security");

  async function revoke(session) {
    const answer = await confirmAction({ title: `همهٔ نشست‌های ${session.phone} بسته شود؟`, body: session.user_id === data.me ? "خودت هم از پنل خارج می‌شوی." : "باید دوباره با رمز و کد Authenticator وارد شود.", danger: true, confirmLabel: "بستن نشست" });
    if (!answer.ok) return;
    if (toastResult(await api.post("/api/admin/security/revoke", { userId: session.user_id }), "نشست‌ها بسته شد.")) reload();
  }

  async function resetAuthenticator(account) {
    const answer = await confirmAction({
      title: `Authenticator ${account.phone} پاک شود؟`,
      body: "همین الان از پنل خارج می‌شود و باید دوباره «راه‌اندازی اولیه» را انجام دهد (به رمز حسابش و کلید راه‌اندازی نیاز دارد).",
      danger: true,
      confirmLabel: "پاک شود"
    });
    if (!answer.ok) return;
    if (toastResult(await api.post("/api/admin/security/reset-authenticator", { userId: account.id }), "Authenticator پاک شد؛ حالا می‌تواند دوباره راه‌اندازی کند.")) reload();
  }

  if (!data) return <><PageHead tab="security" />{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</>;
  const failed24h = data.events.filter((event) => BAD.has(event.action) && Date.now() - new Date(event.created_at).getTime() < 24 * 3600 * 1000).length;
  return (
    <>
      <PageHead tab="security" />
      <div className="admGrid is-three">
        <div className="admStat"><small>مدیر تعریف‌شده</small><b>{num(data.accounts.length)}</b><em>در FRFRO_ADMIN_PHONES</em></div>
        <div className="admStat"><small>نشست فعال پنل</small><b>{num(data.sessions.length)}</b><em>هر مدیر حداکثر یکی</em></div>
        <div className={`admStat${failed24h ? " is-bad" : ""}`}><small>ورود ناموفق (۲۴ ساعت)</small><b>{num(failed24h)}</b><em>{failed24h ? "بررسی کن" : "همه‌چیز آرام است"}</em></div>
      </div>
      <Card title="حساب‌های مدیر" icon={ShieldCheck}>
        <p className="admMuted">این شماره‌ها در <span dir="ltr">FRFRO_ADMIN_PHONES</span> تعریف شده‌اند. اگر مدیری گوشی‌اش را گم کرد، Authenticatorش را اینجا پاک کن تا دوباره راه‌اندازی کند.</p>
        <ul className="admList">
          {data.accounts.map((account) => (
            <li key={account.phone}>
              <span>
                <b dir="ltr">{account.phone}</b> {account.id === data.me ? <span className="admTone is-info">تو</span> : null}
                <br />
                <small>{!account.registered ? "هنوز در سایت ثبت‌نام نکرده" : account.authenticator ? `Authenticator فعال${account.online ? " • الان وارد است" : ""}` : "Authenticator هنوز راه‌اندازی نشده"}</small>
              </span>
              {account.registered && account.id !== data.me && account.authenticator ? <Button size="sm" variant="danger" onClick={() => resetAuthenticator(account)}><KeyRound size={15} aria-hidden="true" /> ریست Authenticator</Button> : null}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="نشست‌های فعال پنل" icon={Smartphone}>
        <ul className="admList">
          {data.sessions.map((session) => (
            <li key={session.user_id}>
              <span><b dir="ltr">{session.phone}</b> {session.user_id === data.me ? <span className="admTone is-info">تو</span> : null}<br /><small>ورود: {fmtDate(session.created_at)} • آخرین فعالیت: {ago(session.last_seen_at)}</small></span>
              <Button size="sm" variant="danger" onClick={() => revoke(session)}><LogOut size={15} aria-hidden="true" /> بستن نشست</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="رویدادهای ورود" icon={ShieldAlert}>
        {data.events.length ? (
          <ul className="admLog">
            {data.events.map((event) => (
              <li key={event.id}>
                <span className={`admLogDot is-${BAD.has(event.action) ? "bad" : "good"}`} aria-hidden="true" />
                <div className="admLogBody"><b>{ACTION_LABEL[event.action] || event.action}</b>{event.detail ? <p dir="ltr">{event.detail}</p> : null}</div>
                <div className="admLogMeta"><time dateTime={event.created_at} title={fmtDate(event.created_at)}>{ago(event.created_at)}</time><small dir="ltr">{event.admin_label || "—"}</small></div>
              </li>
            ))}
          </ul>
        ) : <p className="admMuted">رویدادی نیست.</p>}
      </Card>
    </>
  );
}
