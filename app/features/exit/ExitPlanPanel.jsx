"use client";

import { useState } from "react";
import { Phone, UserRoundCheck, XCircle } from "lucide-react";
import { cancelExitBooking, getExitPlan, proposeHandover } from "../../shared/api/providerExit";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import {
  CALL_FIRST_TEXT,
  CANCEL_ALL_AND_TEXT,
  CANCEL_WITH_NOTICE,
  CLIENT_CAN_CALL,
  HANDOVER_LABEL
} from "../../shared/lib/providerRules";

/**
 * What stands in the way of deleting an account, leaving a team or removing a team member: the confirmed bookings
 * (owner's rules of 2026-10-22). Booking by booking: «تماس با مشتری», «لغو با اطلاع مشتری» and, for a team member,
 * «واگذار به آرتیست دیگر». The server is the judge; this only shows `plan` (GET /api/provider-exit) and asks it again
 * after every change.
 *
 * `onConfirm({ cancelAll })`: «لغو همهٔ نوبت‌ها و ارسال پیامک» (only when nothing is within 24 hours).
 * `confirmLabel`: when given, the panel also shows the main button (the delete-account form has its own).
 */
export function ExitPlanPanel({ plan, scope, params = {}, message = "", confirmLabel = "", busy = false, onPlan, onConfirm, onNotice }) {
  const [workingId, setWorkingId] = useState("");
  const [askId, setAskId] = useState("");
  const [pick, setPick] = useState({});
  const [error, setError] = useState("");

  const refresh = async () => {
    const result = await getExitPlan(scope, params).catch(() => null);
    if (result?.ok && result.payload?.data?.plan) onPlan?.(result.payload.data.plan);
  };

  const cancelOne = async (item) => {
    setWorkingId(`${item.kind}-${item.id}`);
    setError("");
    try {
      const result = await cancelExitBooking(scope, params, item);
      if (result.ok) {
        onNotice?.("نوبت لغو شد و مشتری خبردار شد.");
        if (result.payload?.data?.plan) onPlan?.(result.payload.data.plan);
        else await refresh();
      } else {
        setError(result.payload?.error || "لغو نشد؛ دوباره بزن.");
        await refresh();
      }
    } catch {
      setError("لغو نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    } finally {
      setWorkingId("");
      setAskId("");
    }
  };

  const handOver = async (item) => {
    const toStaff = pick[`${item.kind}-${item.id}`] || item.candidates[0];
    if (!toStaff) return;
    setWorkingId(`${item.kind}-${item.id}`);
    setError("");
    try {
      const body = scope === "staff"
        ? { id: item.id, toStaff, fromStaffId: params.staffId }
        : { id: item.id, toStaff, salonUserId: item.salonUserId };
      const result = await proposeHandover(body);
      if (result.ok) onNotice?.("پیشنهاد رفت برای مشتری؛ تا قبول نکنه، نوبت همون‌طور که بود می‌مونه.");
      else setError(result.payload?.error || "پیشنهاد نرفت؛ دوباره بزن.");
      await refresh();
    } catch {
      setError("پیشنهاد نرفت؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    } finally {
      setWorkingId("");
    }
  };

  const row = (item) => {
    const id = `${item.kind}-${item.id}`;
    const working = workingId === id;
    const phone = item.clientPhone ? toLatinDigits(item.clientPhone) : "";
    return (
      <li className={`pxItem${item.near ? " is-near" : ""}`} key={id}>
        <div className="pxItemHead">
          <b>{item.clientName || "مشتری"}</b>
          <span>{formatRelativeBookingDayLabel(item.date)}، {toPersianDigits(item.time || "")}</span>
        </div>
        <small>{item.service || "نوبت"}{item.staff?.length ? `، ${item.staff.join("، ")}` : ""}</small>
        {item.near ? <p className="pxHint">{CALL_FIRST_TEXT}</p> : null}
        {item.proposalPending ? (
          <p className="pxWait">منتظر جواب مشتری هستیم{item.proposalStaff ? ` (پیشنهاد: ${item.proposalStaff})` : ""}؛ تا قبول نکنه، نوبت همون‌طور که بود می‌مونه.</p>
        ) : null}
        <div className="pxActions">
          {phone ? (
            <a className="pxBtn" href={`tel:${phone}`}><Phone size={15} aria-hidden="true" />{CLIENT_CAN_CALL}<span dir="ltr">{toPersianDigits(item.clientPhone)}</span></a>
          ) : <span className="pxNoPhone">مشتری شماره نداره.</span>}
          {askId === id ? (
            <span className="pxAsk" role="alertdialog" aria-label="تأیید لغو">
              <span>مشتری با پیامک و اعلان خبردار می‌شه. لغو بشه؟</span>
              <button type="button" className="pxBtn is-danger" disabled={working} onClick={() => cancelOne(item)}>{working ? "دارم لغو می‌کنم…" : "آره، لغو کن"}</button>
              <button type="button" className="pxBtn" disabled={working} onClick={() => setAskId("")}>نه</button>
            </span>
          ) : (
            <button type="button" className="pxBtn is-danger" disabled={Boolean(workingId)} onClick={() => setAskId(id)}><XCircle size={15} aria-hidden="true" />{CANCEL_WITH_NOTICE}</button>
          )}
        </div>
        {item.team && !item.near && !item.proposalPending ? (
          item.canHandover ? (
            <div className="pxHandover">
              <select
                aria-label="آرتیست جایگزین"
                value={pick[id] || item.candidates[0]}
                disabled={Boolean(workingId)}
                onChange={(event) => setPick((current) => ({ ...current, [id]: event.target.value }))}
              >
                {item.candidates.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button type="button" className="pxBtn is-primary" disabled={Boolean(workingId)} onClick={() => handOver(item)}><UserRoundCheck size={15} aria-hidden="true" />{HANDOVER_LABEL}</button>
            </div>
          ) : <p className="pxMuted">این ساعت آرتیست آزادی توی تیم نیست؛ این نوبت رو لغو کن.</p>
        ) : null}
      </li>
    );
  };

  const near = plan?.near || [];
  const far = plan?.farConfirmed || [];
  const nothing = !near.length && !far.length;

  return (
    <section className="pxPanel" aria-live="polite">
      {message ? <p className="pxAlert">{message}</p> : null}
      {error ? <p className="pxAlert is-error">{error}</p> : null}
      {nothing ? <p className="pxMuted">دیگه نوبتی جلوی این کار رو نگرفته.</p> : null}
      {near.length ? (
        <>
          <h4>تا ۲۴ ساعت دیگه</h4>
          <ul className="pxList">{near.map(row)}</ul>
        </>
      ) : null}
      {far.length ? (
        <>
          <h4>نوبت‌های دورتر</h4>
          <ul className="pxList">{far.map(row)}</ul>
        </>
      ) : null}
      {!plan?.blocked && plan?.needsChoice && onConfirm ? (
        <div className="pxAll">
          <p>اگه نمی‌خوای تک‌تک لغو کنی، همه رو یه‌جا لغو کن. هر مشتری پیامک می‌گیره.</p>
          <button type="button" className="pxBtn is-danger" disabled={busy || Boolean(workingId)} onClick={() => onConfirm({ cancelAll: true })}>{busy ? "دارم لغو می‌کنم…" : CANCEL_ALL_AND_TEXT}</button>
        </div>
      ) : null}
      {confirmLabel && onConfirm ? (
        <button
          type="button"
          className="pxBtn is-primary pxConfirm"
          disabled={busy || Boolean(workingId) || plan?.blocked || plan?.needsChoice}
          onClick={() => onConfirm({})}
        >
          {busy ? "یه لحظه…" : confirmLabel}
        </button>
      ) : null}
      {plan?.blocked ? <p className="pxMuted">تا این نوبت‌ها انجام یا لغو نشن، نمی‌شه ادامه داد.</p> : null}
    </section>
  );
}
