"use client";

import { useState } from "react";
import { Bug, CircleCheck, CircleX, Database, Eraser, MessageCircle, RefreshCw, Server, Smartphone, TriangleAlert } from "lucide-react";
import { toPersianDigits } from "../shared/lib/digits";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { ago, bytes, fmtDate, num } from "./format";
import { PageHead } from "./PageHead";
import { Card, EmptyState, ErrorNote, Loading, confirmAction, toastResult, useAdminData } from "./ui";

const TABLE_LABEL = {
  users: "کاربران", posts: "پست‌ها", salon_bookings: "رزرو سالن", artist_bookings: "رزرو آرتیست", support_tickets: "پشتیبانی", support_messages: "پیام‌های پشتیبانی",
  sessions: "نشست‌ها", push_subscriptions: "اشتراک اعلان", sms_log: "گزارش پیامک", rate_limit_hits: "محدودیت درخواست", admin_actions: "گزارش فعالیت", client_errors: "خطاهای اپ"
};

function uptime(seconds) {
  if (seconds < 3600) return `${toPersianDigits(Math.max(1, Math.round(seconds / 60)))} دقیقه`;
  if (seconds < 86400) return `${toPersianDigits(Math.round(seconds / 3600))} ساعت`;
  return `${toPersianDigits(Math.round(seconds / 86400))} روز`;
}

/** One line of the set-up checklist: what it is, whether it is in place, and what to do when it is not. */
function Check({ ok, warn = false, title, detail, fix }) {
  const Icon = ok ? CircleCheck : warn ? TriangleAlert : CircleX;
  return (
    <li className={ok ? "is-ok" : warn ? "is-warn" : "is-bad"}>
      <Icon size={18} aria-hidden="true" />
      <div><b>{title}</b><small>{ok ? detail : fix}</small></div>
    </li>
  );
}

/** Errors on users' phones, grouped by message, newest stack on demand. */
function ErrorGroup({ group }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" className="admErrRow" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="admErrCount">{num(group.count)}×</span>
        <span className="admErrText"><b dir="ltr">{group.message}</b><small>{group.source} • آخرین بار {ago(group.last_at)}{group.url ? ` • ${group.url}` : ""}</small></span>
      </button>
      {open ? (
        <div className="admErrMore">
          <p className="admMuted">اولین بار {fmtDate(group.first_at)} • آخرین بار {fmtDate(group.last_at)}</p>
          {group.user_agent ? <p className="admMuted" dir="ltr">{group.user_agent}</p> : null}
          {group.stack ? <pre dir="ltr">{group.stack}</pre> : <p className="admMuted">ردپایی (stack) فرستاده نشده.</p>}
        </div>
      ) : null}
    </li>
  );
}

/** Is everything working: database, server set-up, SMS, push, background jobs, and crashes on users' phones. */
export function HealthTab() {
  const { data, error, loading, reload } = useAdminData("/api/admin/system", { every: 60 * 1000 });
  const [busy, setBusy] = useState(false);

  async function cleanup() {
    setBusy(true);
    const result = await api.post("/api/admin/system", { action: "cleanup" });
    setBusy(false);
    if (toastResult(result, result.ok ? `پاک شد: ${num(result.payload.data.sessions)} نشست منقضی و ${num(result.payload.data.rateLimits)} ردیف قدیمی.` : "")) reload();
  }
  async function clearErrors() {
    const answer = await confirmAction({ title: "فهرست خطاهای اپ پاک شود؟", body: "وقتی مشکلی را درست کرده‌ای، پاک کن تا خطاهای تازه را راحت‌تر ببینی.", danger: true, confirmLabel: "پاک شود" });
    if (!answer.ok) return;
    setBusy(true);
    const result = await api.post("/api/admin/system", { action: "clear_errors" });
    setBusy(false);
    if (toastResult(result, "فهرست خطاها پاک شد.")) reload();
  }

  const head = (
    <PageHead tab="health">
      <Button variant="secondary" size="sm" disabled={loading} onClick={reload}><RefreshCw size={15} aria-hidden="true" /> بررسی دوباره</Button>
    </PageHead>
  );
  if (!data) return <>{head}{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</>;

  const { health, config, sms, errors } = data;
  const slow = health.db.latencyMs > 250;
  const checks = [
    { ok: config.adminSecret, title: "ورود امن پنل", detail: "FRFRO_ADMIN_SECRET تنظیم است.", fix: "FRFRO_ADMIN_SECRET (۳۲+ نویسه) را در Vercel بگذار." },
    { ok: config.adminPhones > 0, title: `${num(config.adminPhones)} مدیر تعریف‌شده`, detail: "شماره‌ها در FRFRO_ADMIN_PHONES هستند.", fix: "شمارهٔ مدیرها را در FRFRO_ADMIN_PHONES بگذار." },
    { ok: !config.legacyToken, warn: true, title: "توکن قدیمی مدیریت", detail: "خاموش است (امن‌تر).", fix: "FRFRO_ADMIN_TOKEN هنوز تنظیم است؛ اگر اسکریپتی از آن استفاده نمی‌کند، پاکش کن." },
    { ok: Boolean(config.sms), warn: true, title: config.sms ? `پیامک: ${config.sms}` : "پیامک", detail: config.otpRequired ? "تأیید شماره هنگام ثبت‌نام اجباری است." : "وصل است؛ تأیید شماره اختیاری است.", fix: "وصل نیست: ثبت‌نام بدون کد است و بازیابی رمز دستی. راهنما: docs/OPERATIONS.md" },
    { ok: config.push, warn: true, title: "اعلان گوشی (Web Push)", detail: `${num(health.push.users)} نفر روی ${num(health.push.subscriptions)} دستگاه اعلان را روشن کرده‌اند.`, fix: "کلیدهای VAPID کامل نیست؛ هیچ اعلانی فرستاده نمی‌شود." },
    { ok: config.storage, warn: true, title: "فضای ذخیرهٔ تصویر", detail: "تصویرها در Supabase Storage ذخیره می‌شوند.", fix: "Storage تنظیم نیست؛ تصویرها در خود پایگاه داده می‌مانند و آن را سنگین می‌کنند." },
    { ok: config.cron, warn: true, title: "کارهای زمان‌بندی‌شده", detail: health.jobs.lastReminderAt ? `آخرین یادآوری رزرو ${ago(health.jobs.lastReminderAt)} فرستاده شد.` : "CRON_SECRET تنظیم است.", fix: "CRON_SECRET تنظیم نیست؛ یادآوری‌ها و انقضای درخواست‌ها خودکار اجرا نمی‌شوند." }
  ];
  const problems = checks.filter((check) => !check.ok).length;

  return (
    <>
      {head}
      <div className="admGrid">
        <div className={`admStat admHealthStat${slow ? " is-warn" : " is-good"}`}><small><Database size={15} aria-hidden="true" /> پایگاه داده</small><b>{toPersianDigits(health.db.latencyMs)} <small>میلی‌ثانیه</small></b><em>{slow ? "کند است" : "پاسخ سریع"} • {bytes(health.db.sizeBytes)}</em></div>
        <div className="admStat admHealthStat is-good"><small><Server size={15} aria-hidden="true" /> سرور</small><b dir="ltr">{config.version}</b><em>روشن از {uptime(data.uptimeSeconds)} پیش{config.region ? ` • ${config.region}` : ""}</em></div>
        <div className={`admStat admHealthStat${errors.last24h ? " is-bad" : " is-good"}`}><small><Bug size={15} aria-hidden="true" /> خطای اپ (۲۴ ساعت)</small><b>{num(errors.last24h)}</b><em>{num(errors.inWindow)} در {toPersianDigits(errors.days)} روز</em></div>
        <div className={`admStat admHealthStat${sms.failed24h ? " is-bad" : " is-good"}`}><small><MessageCircle size={15} aria-hidden="true" /> پیامک (۲۴ ساعت)</small><b>{num(sms.sent24h)}</b><em>{sms.failed24h ? `${num(sms.failed24h)} ناموفق` : "بدون خطا"}</em></div>
      </div>

      <div className="admTwo">
        <Card title={problems ? `تنظیمات سرور: ${num(problems)} مورد نیاز به توجه` : "تنظیمات سرور: همه درست"} icon={Server}>
          <ul className="admChecks">{checks.map((check) => <Check key={check.title} {...check} />)}</ul>
          {sms.lastFailure ? <p className="admError">آخرین خطای پیامک ({ago(sms.lastFailure.created_at)}): <span dir="ltr">{sms.lastFailure.detail}</span></p> : null}
          <p className="admMuted">نشانی سایت: <span dir="ltr">{config.siteUrl || "—"}</span> • محیط: <span dir="ltr">{config.environment}</span> • PostgreSQL <span dir="ltr">{health.db.version}</span></p>
        </Card>
        <div className="admStack">
          <Card title="کاربران و نشست‌ها" icon={Smartphone}>
            <ul className="admFacts">
              <li><span>الان آنلاین (۵ دقیقه)</span><b>{num(health.sessions.online)}</b></li>
              <li><span>نشست فعال</span><b>{num(health.sessions.live)}</b></li>
              <li><span>نشست منقضی (قابل پاک‌سازی)</span><b>{num(health.sessions.expired)}</b></li>
              <li><span>یادآوری رزرو در ۲۴ ساعت</span><b>{num(health.jobs.reminders24h)}</b></li>
              <li><span>درخواست‌های منقضی‌شده (کل)</span><b>{num(health.jobs.expiredBookings)}</b></li>
            </ul>
            <Button size="sm" variant="secondary" disabled={busy} onClick={cleanup}><Eraser size={15} aria-hidden="true" /> پاک‌سازی نشست‌ها و ردیف‌های قدیمی</Button>
          </Card>
          <Card title="جدول‌ها" icon={Database}>
            <ul className="admTables">
              {health.tables.map((table) => (
                <li key={table.name}><span>{TABLE_LABEL[table.name] || table.name}</span><b>{num(table.rows)}</b><small>{bytes(table.bytes)}</small></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card title={`خطاهای اپ روی گوشی کاربران (${toPersianDigits(errors.days)} روز اخیر)`} icon={Bug} actions={errors.groups.length ? <Button size="sm" variant="ghost" disabled={busy} onClick={clearErrors}>پاک‌کردن فهرست</Button> : null}>
        {errors.groups.length ? (
          <>
            <p className="admMuted">خطاهای یکسان کنار هم آمده‌اند؛ پرتکرارترین بالاست. روی هر کدام بزن تا جزئیات فنی‌اش را ببینی (برای فرستادن به برنامه‌نویس).</p>
            <ul className="admErrors">{errors.groups.map((group) => <ErrorGroup key={`${group.message}|${group.source}`} group={group} />)}</ul>
          </>
        ) : <EmptyState icon={CircleCheck} title="خطایی ثبت نشده">اگر اپ روی گوشی کسی به مشکل بخورد، اینجا می‌بینی.</EmptyState>}
      </Card>
    </>
  );
}
