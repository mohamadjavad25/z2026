"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, CreditCard, Gift } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { ACCOUNT_STATE, PAYMENT_STATUS, fmtDate, fmtDay, num, toman } from "./format";
import { ErrorNote, Loading, toastResult } from "./ui";

export function PaymentStatusTag({ status }) {
  const meta = PAYMENT_STATUS[status] || PAYMENT_STATUS.pending;
  return <span className={`admTone is-${meta.tone}`}>{meta.label}</span>;
}

/** Where one salon or artist stands right now, in one line plus its dates. */
export function AccountStateLine({ account }) {
  if (!account) return null;
  const meta = ACCOUNT_STATE[account.state] || ACCOUNT_STATE.trial;
  return (
    <div className="admBillState">
      <span className={`admTone is-${meta.tone}`}>{meta.label}</span>
      {account.coveredBy ? <span className="admTone is-info">زیر پوشش {account.coveredBy.salonName}</span> : null}
      <span className="admMuted">
        {account.state === "trial" || account.state === "active"
          ? `تا ${fmtDay(account.accessEndsAt)} • ${num(account.daysLeft)} روز مانده`
          : account.state === "grace"
            ? `تمام شد ${fmtDay(account.accessEndsAt)} • ${num(account.graceDaysLeft)} روز مهلت`
            : `از ${fmtDay(account.graceEndsAt)} بسته است`}
      </span>
    </div>
  );
}

const QUICK_DAYS = [7, 30, 180, 365];

/**
 * Adds days to an account: a gift (amount 0) or a payment taken outside the app (card-to-card, cash). The server asks
 * for the password again (the step-up dialog opens by itself) and logs it with the reason.
 */
export function GrantDialog({ userId, name, onClose, onDone }) {
  const [days, setDays] = useState(30);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  const valid = Number.isInteger(days) && days >= 1 && days <= 730 && Number.isInteger(amount) && amount >= 0 && note.trim().length >= 3;

  async function submit(event) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const result = await api.post("/api/admin/billing/grant", { userId: Number(userId), days, amountToman: amount, note: note.trim() });
    setBusy(false);
    if (toastResult(result, `${num(days)} روز به اشتراک ${name || "این حساب"} اضافه شد.`)) onDone?.(result.payload.data);
  }

  return (
    <div className="admModal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="admCard admForm admDialog" role="dialog" aria-modal="true" aria-labelledby="admGrantTitle" onSubmit={submit}>
        <div className="admDialogIcon"><CalendarPlus size={22} aria-hidden="true" /></div>
        <h2 id="admGrantTitle">افزودن روز به اشتراک{name ? ` «${name}»` : ""}</h2>
        <p className="admMuted">روزها به آخر اشتراک فعلی (یا از امروز، اگر تمام شده) اضافه می‌شود و در سابقهٔ پرداخت‌های این حساب ثبت می‌شود.</p>
        <div className="admLabel">
          <span>چند روز</span>
          <div className="admChipsRow">
            {QUICK_DAYS.map((value) => (
              <button key={value} type="button" className={`admTag${days === value ? " is-on" : ""}`} onClick={() => setDays(value)}>{num(value)} روز</button>
            ))}
          </div>
          <input type="number" inputMode="numeric" min={1} max={730} value={Number.isFinite(days) ? days : ""} aria-label="تعداد روز" onChange={(event) => setDays(Math.round(Number(event.target.value)))} autoFocus />
        </div>
        <label className="admLabel">
          <span>مبلغی که بیرون از اپ گرفته شد (تومان)</span>
          <input type="number" inputMode="numeric" min={0} step={1000} value={Number.isFinite(amount) ? amount : ""} onChange={(event) => setAmount(Math.max(0, Math.round(Number(event.target.value) || 0)))} />
          <small className="admMuted">{amount ? `${toman(amount)} در درآمد حساب می‌شود.` : "صفر یعنی هدیه؛ در درآمد حساب نمی‌شود."}</small>
        </label>
        <label className="admLabel">
          <span>دلیل یا توضیح (در گزارش فعالیت می‌ماند)</span>
          <textarea rows={2} maxLength={300} value={note} placeholder="مثلاً: کارت‌به‌کارت ۲۴ آبان، پیگیری ۱۲۳۴۵ • یا: جبران قطعی سرویس" onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="admDialogActions">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>انصراف</Button>
          <Button type="submit" disabled={!valid} loading={busy} loadingLabel="…" icon={amount ? CreditCard : Gift}>{amount ? "ثبت پرداخت و افزودن" : "افزودن هدیه"}</Button>
        </div>
      </form>
    </div>
  );
}

/**
 * The «اشتراک» pane of a user's panel: state now, every payment, and adding days. Clients have no subscription and
 * see a one-line note instead.
 */
export function AccountBilling({ userId, name, onGo }) {
  const [data, setData] = useState(null);
  const [granting, setGranting] = useState(false);
  const load = useCallback(async () => {
    const result = await api.get(`/api/admin/billing/accounts/${userId}`);
    setData(result.ok ? result.payload.data : { error: result.payload?.error || "بارگذاری نشد." });
  }, [userId]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  if (!data) return <Loading />;
  if (data.error) return <ErrorNote error={data.error} onRetry={load} />;
  if (!data.account) return <p className="admMuted">مشتری‌ها اشتراک ندارند؛ فرفرو برای مشتری رایگان است.</p>;

  return (
    <div className="admStack">
      {!data.enabled ? <p className="admNote">اشتراک هنوز روشن نشده؛ این حساب فعلاً بی‌هزینه کار می‌کند. روزهایی که اضافه کنی از الان حساب می‌شوند.</p> : null}
      <AccountStateLine account={data.account} />
      <ul className="admFacts">
        <li><span>پایان ماه رایگان</span><b>{fmtDay(data.account.trialEndsAt)}</b></li>
        <li><span>پرداخت‌شده تا</span><b>{data.account.paidUntil ? fmtDay(data.account.paidUntil) : "—"}</b></li>
        <li><span>دسترسی تا</span><b>{fmtDay(data.account.accessEndsAt)}</b></li>
      </ul>
      <div className="admRowActions">
        <Button size="sm" icon={CalendarPlus} onClick={() => setGranting(true)}>افزودن روز</Button>
      </div>
      <section>
        <h3>پرداخت‌ها</h3>
        {data.payments.length ? (
          <ul className="admRows">
            {data.payments.map((payment) => (
              <li key={payment.id}>
                <button type="button" onClick={() => onGo?.("payments", { id: payment.id })}>
                  <span>{payment.title}<small>{payment.amountToman ? toman(payment.amountToman) : "هدیه"} • {fmtDate(payment.paidAt || payment.createdAt)}</small></span>
                  <PaymentStatusTag status={payment.status} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="admMuted">هنوز پرداختی ندارد.</p>}
      </section>
      {granting ? (
        <GrantDialog userId={userId} name={name} onClose={() => setGranting(false)} onDone={() => { setGranting(false); load(); }} />
      ) : null}
    </div>
  );
}

