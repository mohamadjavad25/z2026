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
        onNotice?.("نوبت لغو شد و مشتری باخبر شد.");
        if (result.payload?.data?.plan) onPlan?.(result.payload.data.plan);
        else await refresh();
      } else {
        setError(result.payload?.error || "لغو انجام نشد؛ دوباره امتحان کن.");
        await refresh();
      }
    } catch {
      setError("لغو انجام نشد؛ اینترنتت را نگاه کن و دوباره امتحان کن.");
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
      if (result.ok) onNotice?.("پیشنهاد برای مشتری فرستاده شد. تا قبول نکند، نوبت همان‌طور که بود می‌ماند.");
      else setError(result.payload?.error || "پیشنهاد فرستاده نشد؛ دوباره امتحان کن.");
      await refresh();
    } catch {
      setError("پیشنهاد فرستاده نشد؛ اینترنتت را نگاه کن و دوباره امتحان کن.");
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
        <small>{item.service || "نوبت"}{item.staff?.length ? ` • ${item.staff.join("، ")}` : ""}</small>
        {item.near ? <p className="pxHint">{CALL_FIRST_TEXT}</p> : null}
        {item.proposalPending ? (
          <p className="pxWait">منتظر جواب مشتری هستیم{item.proposalStaff ? ` (پیشنهاد: ${item.proposalStaff})` : ""}. تا قبول نکند، نوبت همان‌طور که بود می‌ماند.</p>
        ) : null}
        <div className="pxActions">
          {phone ? (
            <a className="pxBtn" href={`tel:${phone}`}><Phone size={15} aria-hidden="true" />{CLIENT_CAN_CALL}<span dir="ltr">{toPersianDigits(item.clientPhone)}</span></a>
          ) : <span className="pxNoPhone">شمارهٔ مشتری ثبت نشده.</span>}
          {askId === id ? (
            <span className="pxAsk" role="alertdialog" aria-label="تأیید لغو">
              <span>مشتری با پیامک و اعلان باخبر می‌شود. لغو شود؟</span>
              <button type="button" className="pxBtn is-danger" disabled={working} onClick={() => cancelOne(item)}>{working ? "در حال لغو…" : "بله، لغو شود"}</button>
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
          ) : <p className="pxMuted">در این ساعت آرتیست آزادی در تیم نیست؛ این نوبت را لغو کن.</p>
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
      {nothing ? <p className="pxMuted">نوبت تأییدشده‌ای جلوی این کار نمانده.</p> : null}
      {near.length ? (
        <>
          <h4>تا ۲۴ ساعت دیگر</h4>
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
          <p>اگر نمی‌خواهی تک‌تک لغو کنی، همه را یک‌جا لغو کن. هر مشتری پیامک می‌گیرد.</p>
          <button type="button" className="pxBtn is-danger" disabled={busy || Boolean(workingId)} onClick={() => onConfirm({ cancelAll: true })}>{busy ? "در حال لغو…" : CANCEL_ALL_AND_TEXT}</button>
        </div>
      ) : null}
      {confirmLabel && onConfirm ? (
        <button
          type="button"
          className="pxBtn is-primary pxConfirm"
          disabled={busy || Boolean(workingId) || plan?.blocked || plan?.needsChoice}
          onClick={() => onConfirm({})}
        >
          {busy ? "در حال انجام…" : confirmLabel}
        </button>
      ) : null}
      {plan?.blocked ? <p className="pxMuted">تا این نوبت‌ها انجام یا لغو نشوند، نمی‌شود ادامه داد.</p> : null}
    </section>
  );
}
