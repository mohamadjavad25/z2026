"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, CircleCheck, CreditCard, FlaskConical, MessageSquareText, RefreshCw, Search, Settings2, Store, TriangleAlert, UserRound } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { TYPE_LABEL, ago, fmtDate, fmtDay, num, toman } from "./format";
import { PageHead } from "./PageHead";
import { SplitView } from "./SplitView";
import { AccountStateLine, GrantDialog, PaymentStatusTag } from "./BillingAdmin";
import { Card, EmptyState, ErrorNote, Loading, Pager, Segmented, Skeleton, Toggle, confirmAction, toastResult, useAdminData, withQuery } from "./ui";

const PAGE_SIZE = 30;
const STATUS = [{ value: "", label: "همه" }, { value: "paid", label: "پرداخت‌شده" }, { value: "pending", label: "در انتظار" }, { value: "failed", label: "ناموفق" }];
const SOURCE = [{ value: "", label: "همه" }, { value: "gateway", label: "درگاه" }, { value: "admin", label: "ثبت مدیر" }];
const GRACE = [0, 1, 3, 5, 7].map((value) => ({ value, label: `${num(value)} روز` }));

/** The switch, the gateway, the SMS patterns and the price list: everything that decides whether money can come in. */
function SetupCard({ data, onSaved }) {
  const [value, setValue] = useState(data.settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(data.settings), [data.settings]);
  const { gateway, sms } = data;
  const dirty = ["enabled", "graceDays", "salonCoversArtists"].some((key) => value[key] !== data.settings[key]);
  const enforced = data.settings.enabled && gateway.ready;

  async function save() {
    if (value.enabled !== data.settings.enabled) {
      const answer = await confirmAction(value.enabled
        ? {
            title: "اشتراک روشن شود؟",
            body: data.settings.launchedAt
              ? "اشتراک دوباره روشن می‌شود. ماه رایگان هر حساب همان قبلی است."
              : `ماه رایگان همهٔ سالن‌ها و آرتیست‌های فعلی از امروز شروع می‌شود (حساب‌های تازه از روز ثبت‌نام). ${gateway.ready ? "بعد از ماه رایگان و مهلت، حسابی که اشتراک نخرد از جست‌وجو کنار می‌رود و نوبت آنلاین نمی‌گیرد." : "تا درگاه وصل نشود هیچ حسابی بسته نمی‌شود."}`,
            confirmLabel: "روشن شود"
          }
        : { title: "اشتراک خاموش شود؟", body: "دیگر کسی نمی‌تواند پرداخت کند، یادآوری نمی‌رود و هیچ حسابی به‌خاطر اشتراک بسته نمی‌ماند. پرداخت‌های قبلی سر جایشان است.", danger: true, confirmLabel: "خاموش شود" });
      if (!answer.ok) return;
    }
    setBusy(true);
    const result = await api.put("/api/admin/billing/settings", { enabled: value.enabled, graceDays: value.graceDays, salonCoversArtists: value.salonCoversArtists });
    setBusy(false);
    if (toastResult(result, "تنظیمات اشتراک ذخیره شد.")) onSaved();
  }

  return (
    <Card title="راه‌اندازی اشتراک" icon={Settings2} actions={data.settings.updatedAt ? <small className="admMuted">آخرین تغییر {ago(data.settings.updatedAt)}{data.settings.updatedBy ? <> • <span dir="ltr">{data.settings.updatedBy}</span></> : null}</small> : null}>
      <ul className="admBillChecks">
        <li className={data.settings.enabled ? "is-ok" : "is-missing"}>
          <b>{data.settings.enabled ? "اشتراک روشن است" : "اشتراک خاموش است"}</b>
          <span>{data.settings.launchedAt ? `ماه رایگان حساب‌های قدیمی از ${fmtDay(data.settings.launchedAt)} شروع شد.` : "هنوز هیچ‌وقت روشن نشده؛ همه رایگان کار می‌کنند."}</span>
        </li>
        <li className={gateway.ready ? (gateway.sandbox ? "is-warn" : "is-ok") : "is-missing"}>
          <b>{gateway.ready ? `درگاه: ${gateway.label}` : "درگاه وصل نیست"}</b>
          <span>
            {gateway.sandbox ? "درگاه آزمایشی است: پولی گرفته نمی‌شود. برای پرداخت واقعی FRFRO_PAYMENT_GATEWAY را عوض کن." : null}
            {!gateway.ready ? <>کم است: <span dir="ltr">{gateway.missing.join("، ") || "FRFRO_PAYMENT_GATEWAY"}</span>. درگاه‌های آماده: {gateway.available.map((item) => item.label).join("، ")}.</> : null}
            {gateway.ready && !gateway.sandbox ? "پرداخت واقعی گرفته می‌شود." : null}
          </span>
        </li>
        <li className={enforced ? "is-ok" : "is-warn"}>
          <b>{enforced ? "حساب‌های بدون اشتراک بسته می‌شوند" : "هیچ حسابی بسته نمی‌شود"}</b>
          <span>{enforced ? `بعد از پایان اشتراک و ${num(data.settings.graceDays)} روز مهلت، از جست‌وجو کنار می‌روند و نوبت آنلاین نمی‌گیرند.` : "تا اشتراک روشن نباشد و درگاه وصل نباشد، به هیچ حسابی سخت گرفته نمی‌شود."}</span>
        </li>
      </ul>

      <div className="admForm">
        <Toggle checked={value.enabled} disabled={busy} onChange={(enabled) => setValue({ ...value, enabled })} label="اشتراک سالن و آرتیست" hint="روشن: پرداخت ممکن است و یادآوری‌ها می‌روند" />
        <Toggle checked={value.salonCoversArtists} disabled={busy} onChange={(salonCoversArtists) => setValue({ ...value, salonCoversArtists })} label="آرتیست‌های عضو سالن رایگان" hint="تا وقتی سالنشان اشتراک دارد، لازم نیست جدا پرداخت کنند" />
        <div className="admLabel">
          <span>مهلت بعد از پایان اشتراک</span>
          <Segmented label="مهلت" size="sm" value={value.graceDays} onChange={(graceDays) => setValue({ ...value, graceDays })} options={GRACE} />
        </div>
        <div className="admRowActions">
          <Button disabled={!dirty || busy} loading={busy} loadingLabel="…" onClick={save}>ذخیره</Button>
          {dirty ? <Button variant="ghost" onClick={() => setValue(data.settings)}>برگرداندن</Button> : null}
        </div>
      </div>

      <details className="admBillMore">
        <summary>قیمت‌ها و پیامک‌ها</summary>
        <div className="admBillPrices">
          {["salon", "artist"].map((role) => (
            <div key={role}>
              <h3>{TYPE_LABEL[role]}</h3>
              <ul className="admFacts">
                {data.plans.filter((plan) => plan.role === role).map((plan) => (
                  <li key={plan.id}><span>{plan.title.replace(/^اشتراک /, "")} • {num(plan.days)} روز</span><b>{toman(plan.amountToman)}</b></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="admMuted">ماه رایگان {num(data.trialDays)} روز. قیمت‌ها در <span dir="ltr">app/lib/billing/plans.js</span> تعریف شده‌اند؛ تغییرشان فقط روی پرداخت‌های بعدی اثر دارد.</p>
        <h3><MessageSquareText size={15} aria-hidden="true" /> پیامک‌ها {sms.provider ? <span className="admMuted">({sms.provider})</span> : <span className="admMuted">(پیامک وصل نیست)</span>}</h3>
        <ul className="admFacts">
          {sms.templates.map((template) => (
            <li key={template.key}><span>{template.label} <small dir="ltr">{template.env}</small></span><b>{template.configured ? <span className="admTone is-good">آماده</span> : <span className="admTone">تنظیم نشده</span>}</b></li>
          ))}
        </ul>
        <p className="admMuted">هر پیامک با الگوی خودش در سرویس پیامک فرستاده می‌شود؛ تا الگو تنظیم نشود فقط اعلان گوشی می‌رود. راهنما: docs/OPERATIONS.md، بخش «پیامک اشتراک».</p>
      </details>
    </Card>
  );
}

/** One payment with everything about it, the account behind it, and what can be done. */
function PaymentDetail({ id, onGo, onSelect, onChanged }) {
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [granting, setGranting] = useState(false);
  const load = useCallback(async () => {
    const result = await api.get(`/api/admin/billing/payments/${id}`);
    setFound(result.ok ? result.payload.data : { error: result.payload?.error || "بارگذاری نشد." });
  }, [id]);
  useEffect(() => {
    setFound(null);
    load();
  }, [load]);

  if (!found) return <Loading />;
  if (found.error) return <ErrorNote error={found.error} onRetry={load} />;
  const { payment, account, history } = found;

  async function reverify() {
    setBusy(true);
    const result = await api.post(`/api/admin/billing/payments/${id}`, { action: "reverify" });
    setBusy(false);
    if (result.ok) {
      setFound(result.payload.data);
      const status = result.payload.data.payment.status;
      toastResult(result, status === "paid" ? "بانک تأیید کرد؛ اشتراک فعال شد." : status === "failed" ? "بانک گفت پرداخت انجام نشده است." : "بانک هنوز جواب قطعی نداد.");
      onChanged?.();
    } else toastResult(result, "");
  }

  return (
    <div className="admDetail">
      <header className="admDetailHead">
        <span className="admTicketIcon"><CreditCard size={18} aria-hidden="true" /></span>
        <div>
          <h2>{payment.title}</h2>
          <p className="admMuted">{payment.receiptNo ? <span dir="ltr">{payment.receiptNo}</span> : `پرداخت ${num(payment.id)}`} • {payment.gatewayLabel}</p>
        </div>
        <PaymentStatusTag status={payment.status} />
      </header>
      {payment.sandbox ? <p className="admNote admBanner"><FlaskConical size={16} aria-hidden="true" /> پرداخت آزمایشی؛ پولی جابه‌جا نشده و در درآمد حساب نمی‌شود.</p> : null}

      <div className="admWhen">
        <div><small>مبلغ</small><b>{payment.amountToman ? toman(payment.amountToman) : "هدیه"}</b></div>
        <div><small>مدت</small><b>{num(payment.days)} روز</b></div>
        <div><small>اعتبار تا</small><b>{payment.periodEnd ? fmtDay(payment.periodEnd) : "—"}</b></div>
      </div>

      <div className="admPerson">
        <span className="admPersonIcon">{payment.userType === "salon" ? <Store size={17} aria-hidden="true" /> : <UserRound size={17} aria-hidden="true" />}</span>
        <div>
          <small>{TYPE_LABEL[payment.userType] || "حساب"}</small>
          {payment.userId ? <button type="button" className="admRowLink" onClick={() => onGo("users", { id: payment.userId })}>{payment.userName || "بدون نام"} ←</button> : <b>{payment.userName || "—"} (حساب حذف شده)</b>}
          <span className="admMuted" dir="ltr">{payment.userPhone}</span>
        </div>
      </div>

      <ul className="admFacts">
        <li><span>شروع پرداخت</span><b>{fmtDate(payment.createdAt)} ({ago(payment.createdAt)})</b></li>
        {payment.paidAt ? <li><span>پرداخت</span><b>{fmtDate(payment.paidAt)}</b></li> : null}
        {payment.periodStart ? <li><span>دوره</span><b>{fmtDay(payment.periodStart)} تا {fmtDay(payment.periodEnd)}</b></li> : null}
        {payment.refId ? <li><span>کد پیگیری بانک</span><b dir="ltr">{payment.refId}</b></li> : null}
        {payment.cardPan ? <li><span>کارت</span><b dir="ltr">{payment.cardPan}</b></li> : null}
        {payment.authority ? <li><span>شناسهٔ درگاه</span><b dir="ltr">{payment.authority}</b></li> : null}
        {payment.source === "admin" ? <li><span>ثبت توسط</span><b dir="ltr">{payment.adminLabel || "—"}</b></li> : null}
        {payment.note ? <li><span>توضیح</span><b>{payment.note}</b></li> : null}
        {payment.failure ? <li><span>دلیل ناموفق</span><b>{payment.failure}</b></li> : null}
        {payment.source === "gateway" ? <li><span>پرسش از درگاه</span><b>{num(payment.verifyAttempts)} بار{payment.lastVerifyAt ? ` • آخرین ${ago(payment.lastVerifyAt)}` : ""}</b></li> : null}
        {payment.detail ? <li><span>پاسخ فنی درگاه</span><b dir="ltr">{payment.detail}</b></li> : null}
      </ul>

      {payment.status === "pending" && payment.authority ? (
        <section className="admBillAction">
          <h3><TriangleAlert size={15} aria-hidden="true" /> هنوز در انتظار</h3>
          <p className="admMuted">یا پرداخت‌کننده هنوز در صفحهٔ بانک است، یا جواب بانک نرسیده. سامانه هر ساعت خودش دوباره می‌پرسد؛ با این دکمه همین الان بپرس.</p>
          <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy} loadingLabel="در حال پرسیدن…" onClick={reverify}>پرسیدن دوباره از درگاه</Button>
        </section>
      ) : null}

      {account ? (
        <section>
          <h3>این حساب الان</h3>
          <AccountStateLine account={account} />
          <div className="admRowActions"><Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => setGranting(true)}>افزودن روز</Button></div>
        </section>
      ) : null}

      {history.length ? (
        <section>
          <h3>پرداخت‌های دیگر این حساب</h3>
          <ul className="admRows">
            {history.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => onSelect(row.id)}>
                  <span>{row.title}<small>{row.amountToman ? toman(row.amountToman) : "هدیه"} • {fmtDate(row.paidAt || row.createdAt)}</small></span>
                  <PaymentStatusTag status={row.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {granting ? (
        <GrantDialog userId={payment.userId} name={payment.userName} onClose={() => setGranting(false)} onDone={() => { setGranting(false); load(); onChanged?.(); }} />
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint, bad = false }) {
  return (
    <div className={`admStat${bad ? " is-bad" : ""}`}>
      <small>{label}</small>
      <b>{value}</b>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

/**
 * «پرداخت‌ها»: whether billing is on and payable, money in, where every salon and artist stands, and the full ledger
 * (filter, search, one payment beside the list, ask the gateway again, add days).
 */
export function PaymentsTab({ intent = {}, onGo, setParam, onChanged }) {
  const [q, setQ] = useState(intent.q || "");
  const [status, setStatus] = useState(intent.status || "");
  const [source, setSource] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(intent.id ? Number(intent.id) : null);
  const path = withQuery("/api/admin/billing", { q: q.trim(), status, source, offset, limit: PAGE_SIZE });
  const { data, error, loading, reload } = useAdminData(path, { debounce: q ? 250 : 0, every: 60_000 });
  useEffect(() => {
    setParam?.("id", selected);
  }, [selected, setParam]);
  const reset = (fn) => (value) => {
    fn(value);
    setOffset(0);
  };

  if (!data) return <><PageHead tab="payments" />{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</>;
  const { stats, payments } = data;

  const list = (
    <section className="admCard admListCard">
      <div className="admToolbar">
        <label className="admInlineSearch">
          <Search size={17} aria-hidden="true" />
          <input type="search" value={q} placeholder="نام، شماره، شمارهٔ رسید یا کد پیگیری…" aria-label="جست‌وجو در پرداخت‌ها" onChange={(event) => reset(setQ)(event.target.value)} />
        </label>
        <Segmented label="وضعیت" size="sm" value={status} onChange={reset(setStatus)} options={STATUS.map((item) => ({ ...item, count: item.value ? data.counts[item.value] || 0 : undefined }))} />
        <Segmented label="منبع" size="sm" value={source} onChange={reset(setSource)} options={SOURCE} />
      </div>
      {loading && !payments.length ? <Skeleton rows={6} /> : null}
      {payments.length ? (
        <div className={`admTableWrap${loading ? " is-stale" : ""}`}>
          <table className="admTable is-clickable">
            <thead><tr><th>حساب</th><th>پلن</th><th>مبلغ</th><th>زمان</th><th>وضعیت</th></tr></thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className={selected === payment.id ? "is-selected" : ""} onClick={() => setSelected(payment.id)}>
                  <td>
                    <button type="button" className="admRowLink" onClick={(event) => { event.stopPropagation(); setSelected(payment.id); }}>{payment.userName || "—"}</button>
                    <small>{TYPE_LABEL[payment.userType] || ""} • <span dir="ltr">{payment.userPhone}</span></small>
                  </td>
                  <td>{payment.title}{payment.sandbox ? <small>آزمایشی</small> : null}</td>
                  <td>{payment.amountToman ? toman(payment.amountToman) : "هدیه"}</td>
                  <td>{fmtDate(payment.paidAt || payment.createdAt)}</td>
                  <td><PaymentStatusTag status={payment.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading ? (
        <EmptyState icon={CreditCard} title={q || status || source ? "پرداختی با این فیلترها نیست" : "هنوز پرداختی ثبت نشده"}>
          {q || status || source ? "فیلترها را تغییر بده." : "وقتی اشتراک روشن شود و اولین سالن یا آرتیست پرداخت کند، اینجا می‌آید."}
        </EmptyState>
      ) : null}
      <Pager total={data.total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} noun="پرداخت" />
    </section>
  );

  return (
    <>
      <PageHead tab="payments" />
      <SetupCard data={data} onSaved={() => { reload(); onChanged?.(); }} />
      <div className="admGrid admBillStats">
        <Stat label="درآمد ۲۴ ساعت" value={toman(stats.revenue.dayToman)} hint={`${num(stats.revenue.dayCount)} پرداخت`} />
        <Stat label="درآمد ۳۰ روز" value={toman(stats.revenue.monthToman)} hint={`${num(stats.revenue.monthCount)} پرداخت • کل ${toman(stats.revenue.allToman)}`} />
        <Stat label="اشتراک فعال" value={num(stats.accounts.active)} hint={`${num(stats.accounts.trial)} در ماه رایگان`} />
        <Stat label="نیاز به تمدید" value={num(stats.accounts.grace + stats.accounts.expired)} hint={`${num(stats.accounts.grace)} در مهلت • ${num(stats.accounts.expired)} غیرفعال${stats.accounts.coveredBySalon ? ` (${num(stats.accounts.coveredBySalon)} زیر پوشش سالن)` : ""}`} bad={stats.accounts.expired > 0 && data.settings.enabled} />
      </div>
      {stats.stuckPending ? (
        <p className="admNote admBanner"><TriangleAlert size={16} aria-hidden="true" /> {num(stats.stuckPending)} پرداخت بیش از ۱۰ دقیقه است در انتظار مانده. فیلتر «در انتظار» را بزن و از درگاه دوباره بپرس.</p>
      ) : data.total ? <p className="admNote admOk admBanner"><CircleCheck size={16} aria-hidden="true" /> پرداخت گیرکرده‌ای نیست.</p> : null}
      <SplitView
        list={list}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        label="جزئیات پرداخت"
        emptyHint="روی یک پرداخت بزن تا رسید، حساب و ابزارهایش را ببینی."
        detail={selected ? <PaymentDetail key={selected} id={selected} onGo={onGo} onSelect={setSelected} onChanged={reload} /> : null}
      />
    </>
  );
}
