"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { getTeamLedger, sendTeamSettlement, setTeamLineAmount } from "../../shared/api/team";
import { toPersianDigits, toLatinDigits } from "../../shared/lib/digits";
import { formatPersianDateKey } from "../../shared/lib/persianCalendar";
import { keyLabel, toman } from "./teamWeek";

/** «۴۵۰٬۰۰۰» typed in any digits → 450000; null when it is not a whole number. */
function parseTyped(text) {
  const digits = toLatinDigits(String(text || "")).replace(/[,٬\s]/g, "");
  return /^\d{1,12}$/.test(digits) ? Number(digits) : null;
}

/**
 * «حساب» of one team pair (owner's decision 2026-10-28), the same book for both sides: every finished booking with each
 * side's share on its day, the net of what is owed, and «تصفیه کردیم» that the other side confirms. Nothing here moves money.
 * The salon may change the price of an open line (a discount); the first price stays visible.
 */
export function TeamLedgerSheet({ open, pair, otherName, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(null); // null | "start" | "dispute": the amount field is open
  const [typed, setTyped] = useState("");
  const [editLine, setEditLine] = useState(null);
  const [lineTyped, setLineTyped] = useState("");
  const key = JSON.stringify(pair);

  const load = useCallback(async () => {
    try {
      const result = await getTeamLedger(JSON.parse(key));
      if (result.ok) setData(result.data); else setError(result.payload?.error || "حساب باز نشد؛ دوباره بزن.");
    } catch {
      setError("حساب باز نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    }
  }, [key]);
  useEffect(() => { if (open) { setError(""); setPaying(null); setEditLine(null); load(); } }, [open, load]);

  const run = async (task) => {
    setBusy(true);
    setError("");
    try {
      const result = await task();
      if (!result.ok) { setError(result.payload?.error || "نشد؛ دوباره بزن."); await load(); return false; }
      setData(result.data);
      return true;
    } catch {
      setError("نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const side = data?.side || (pair.artistUserId ? "salon" : "artist");
  const totals = data?.totals;
  // net > 0: the salon pays the artist.
  const owes = !totals || totals.net === 0 ? "" : (totals.net > 0) === (side === "salon") ? "pay" : "get";
  const headline = !totals ? "" : owes === "pay" ? `الان باید به ${otherName} بدی` : owes === "get" ? `${otherName} باید به تو بده` : "حساب صافه";
  const waiting = data?.waiting;
  const mineWaiting = waiting && waiting.startedBy === side;

  const startPaying = (mode) => { setPaying(mode); setTyped(String(mode === "start" ? Math.abs(totals?.net || 0) : waiting?.expected || "")); };
  const submitPaying = async () => {
    const amount = parseTyped(typed);
    if (amount === null || (paying === "start" && amount <= 0)) { setError("مبلغ رو با عدد بنویس."); return; }
    const ok = await run(() => (paying === "start" ? sendTeamSettlement(pair, { action: "start", paid: amount }) : sendTeamSettlement(pair, { action: "dispute", id: waiting.id, amount })));
    if (ok) setPaying(null);
  };
  const saveLine = async (line) => {
    const amount = parseTyped(lineTyped);
    if (amount === null) { setError("مبلغ رو با عدد بنویس."); return; }
    const ok = await run(() => setTeamLineAmount(pair, line.id, amount));
    if (ok) setEditLine(null);
  };

  return (
    <ProfileSheet open={open} kicker="حساب" title={`حساب با ${otherName}`} panelClassName="tlSheet" onClose={onClose}>
      {!data && !error ? <p className="tlMuted">یه لحظه…</p> : null}
      {error ? <p className="tsError" role="alert">{error}</p> : null}

      {data ? (
        <>
          <section className={`tlMain${owes ? ` is-${owes}` : ""}`} aria-label="جمع حساب">
            <small>{headline}</small>
            <b>{toman(totals.net)}</b>
            <div className="tlSplit">
              <div><small>سهم آرتیست</small><b>{toman(totals.artistShare)}</b></div>
              <div><small>سهم سالن</small><b>{toman(totals.salonShare)}</b></div>
            </div>
            {data.terms?.share != null ? <p className="tlMuted">درصد الان: آرتیست {toPersianDigits(data.terms.share)} درصد{data.terms.ownShare != null ? `، مشتری خودش ${toPersianDigits(data.terms.ownShare)} درصد` : ""}.</p> : null}
            {totals.unknown ? <p className="tlWarn">برای {toPersianDigits(totals.unknown)} کار درصد مشخص نیست. توی «شرایط کار» درصد رو پیشنهاد بدین؛ وقتی قبول شد، حساب این کارها هم حساب می‌شه.</p> : null}
          </section>

          {waiting ? (
            <section className={`tlWait${mineWaiting ? "" : " is-live"}`} aria-label="تصفیه منتظر جواب">
              {mineWaiting ? (
                <>
                  <span className="ttChip is-soft">منتظر تأیید {otherName}</span>
                  <p>گفتی {toman(waiting.paid)} پرداخت شد. تا {otherName} تأیید نکنه، حساب بسته نمی‌شه.</p>
                  <button type="button" className="ttLink" disabled={busy} onClick={() => run(() => sendTeamSettlement(pair, { action: "cancel", id: waiting.id }))}>تصفیه رو بردار</button>
                </>
              ) : (
                <>
                  <span className="ttChip">منتظر تأیید توئه</span>
                  <p>{otherName} می‌گه {toman(waiting.paid)} پرداخت شد.{waiting.paid !== waiting.expected ? ` حساب ${toman(waiting.expected)} بود.` : ""}</p>
                  {paying === "dispute" ? (
                    <div className="tlPay">
                      <label><span>چقدر پرداخت شد؟</span><input inputMode="numeric" value={typed} onChange={(event) => setTyped(event.target.value)} aria-label="مبلغ واقعی" /></label>
                      <button type="button" className="is-pink" disabled={busy} onClick={submitPaying}>ثبت</button>
                    </div>
                  ) : (
                    <div className="ttActions">
                      <button type="button" className="is-soft" disabled={busy} onClick={() => startPaying("dispute")}>مبلغ فرق داره</button>
                      <button type="button" className="is-pink" disabled={busy} onClick={() => run(() => sendTeamSettlement(pair, { action: "confirm", id: waiting.id }))}>{waiting.salonPays === (side === "salon") ? "آره، دادم" : "آره، گرفتم"}</button>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : totals.net !== 0 && !totals.unknown ? (
            paying === "start" ? (
              <section className="tlPay" aria-label="تصفیه">
                <label><span>چقدر پرداخت شد؟</span><input inputMode="numeric" value={typed} onChange={(event) => setTyped(event.target.value)} aria-label="مبلغ پرداخت‌شده" /></label>
                <button type="button" className="is-pink" disabled={busy} onClick={submitPaying}>ثبت تصفیه</button>
                <button type="button" className="ttLink" onClick={() => setPaying(null)}>بیخیال</button>
              </section>
            ) : (
              <button type="button" className="tlSettle" onClick={() => startPaying("start")}>تصفیه کردیم</button>
            )
          ) : null}

          <section aria-label="کارهای انجام‌شده">
            <div className="tlHead"><b>کارهای انجام‌شده</b><small>{toPersianDigits(data.lines.length)} کار</small></div>
            {data.lines.length ? (
              <ul className="tlLines">
                {data.lines.map((line) => (
                  <li key={line.id}>
                    <span className="tlLineMain">
                      <b>{line.service || "کار"}</b>
                      <small>{line.client ? `${line.client}، ` : ""}{keyLabel(line.date)}، {line.own ? "مشتری خودش" : "مشتری سالن"}{line.share != null ? `، ${toPersianDigits(line.share)}٪` : ""}</small>
                    </span>
                    {editLine === line.id ? (
                      <span className="tlEdit">
                        <input inputMode="numeric" autoFocus value={lineTyped} onChange={(event) => setLineTyped(event.target.value)} aria-label="قیمت تازه" />
                        <button type="button" disabled={busy} onClick={() => saveLine(line)}>ثبت</button>
                      </span>
                    ) : (
                      <span className="tlAmount">
                        {line.amount !== line.originalAmount ? <s>{toman(line.originalAmount)}</s> : null}
                        <b>{toman(line.amount)}</b>
                        {side === "salon" ? <button type="button" aria-label={`عوض کردن قیمت ${line.service}`} onClick={() => { setEditLine(line.id); setLineTyped(String(line.amount)); }}><Pencil size={13} aria-hidden="true" /></button> : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tlMuted">هنوز کاری انجام نشده. وقتی نوبتی تموم شه، حسابش اینجا میاد.</p>
            )}
            <p className="tlMuted">فقط کارهای انجام‌شده حساب می‌شن. لغو و «نیومد» حساب نمی‌شن.{side === "artist" ? " قیمت هر کار رو فقط سالن می‌تونه عوض کنه، ولی تو تغییرش رو می‌بینی." : " قیمت هر کار رو می‌تونی تا قبل از تصفیه عوض کنی (مثلاً برای تخفیف)؛ قیمت اولش می‌مونه."}</p>
          </section>

          {data.closed.length ? (
            <section aria-label="تصفیه‌های قبلی">
              <div className="tlHead"><b>تصفیه‌های قبلی</b></div>
              <ul className="tlLines">
                {data.closed.map((item) => (
                  <li key={item.id}>
                    <span className="tlLineMain"><b>{toman(item.paid)}</b><small>{item.status === "confirmed" ? "هر دو تأیید کردن" : `${otherName} گفت ${toman(item.otherAmount ?? 0)}؛ بسته نشد`}</small></span>
                    <span className="tlAmount"><small>{keyLabel(formatPersianDateKey(new Date(item.createdAt)))}</small></span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </ProfileSheet>
  );
}
