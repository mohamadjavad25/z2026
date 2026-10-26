"use client";

import { useState } from "react";
import { Phone, XCircle } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { clientBlockedText, clientCallFirstText, clientRestText } from "../../shared/lib/clientExitText";

/** GET /api/client-exit → { data: { plan } } */
export function getClientExitPlan() {
  return apiFetch("/api/client-exit");
}

/**
 * A client deleting their account while bookings are open (owner's decision 2026-10-26). Bookings within 24 hours block
 * it: each has «تماس با …» and «لغو نوبت» (which first says to call). The rest are only listed: «لغو همه و پاک کردن حساب»
 * (the form's own button) cancels them with the deletion. The server is the judge; this only shows `plan` and asks again
 * after every cancel.
 */
export function ClientExitPanel({ plan, onPlan, onNotice }) {
  const [askId, setAskId] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const result = await getClientExitPlan().catch(() => null);
    if (result?.ok && result.payload?.data?.plan) onPlan?.(result.payload.data.plan);
  };

  const cancelOne = async (item) => {
    const id = `${item.kind}-${item.id}`;
    setWorkingId(id);
    setError("");
    try {
      const result = await apiFetch(`/api/${item.kind === "artist" ? "artist-bookings" : "salon-bookings"}/${item.id}/cancel`, { method: "POST", body: "{}" });
      if (result.ok) onNotice?.(`نوبت لغو شد و ${item.providerName || "سالن"} خبردار شد.`);
      else setError(result.payload?.error || "لغو نشد؛ دوباره بزن.");
    } catch {
      setError("لغو نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    } finally {
      setWorkingId("");
      setAskId("");
      await refresh();
    }
  };

  const when = (item) => `${formatRelativeBookingDayLabel(item.date)}${item.time ? `، ${toPersianDigits(item.time)}` : ""}`;
  const near = plan?.near || [];
  const rest = plan?.rest || [];

  const nearRow = (item) => {
    const id = `${item.kind}-${item.id}`;
    const working = workingId === id;
    const phone = item.providerPhone ? toLatinDigits(item.providerPhone) : "";
    return (
      <li className="pxItem is-near" key={id}>
        <div className="pxItemHead">
          <b>{item.service || "نوبت"}، {item.providerName || "سالن"}</b>
          <span>{when(item)}</span>
        </div>
        {item.started ? <small>این نوبت شروع شده؛ وقتی تموم بشه می‌تونی حسابت رو پاک کنی.</small> : null}
        <div className="pxActions">
          {phone ? (
            <a className="pxBtn" href={`tel:${phone}`}><Phone size={15} aria-hidden="true" />تماس با {item.providerName || "سالن"}</a>
          ) : null}
          {item.started ? null : askId === id ? (
            <span className="pxAsk" role="alertdialog" aria-label="تأیید لغو">
              <span>{clientCallFirstText(item.providerName)}</span>
              {phone ? <span className="pxMuted">شماره‌ش: <span dir="ltr">{toPersianDigits(item.providerPhone)}</span></span> : null}
              <button type="button" className="pxBtn is-danger" disabled={working} onClick={() => cancelOne(item)}>{working ? "دارم لغو می‌کنم…" : "لغو کن و خبر بده"}</button>
              <button type="button" className="pxBtn" disabled={working} onClick={() => setAskId("")}>نه، بمونه</button>
            </span>
          ) : (
            <button type="button" className="pxBtn is-danger" disabled={Boolean(workingId)} onClick={() => setAskId(id)}><XCircle size={15} aria-hidden="true" />لغو نوبت</button>
          )}
        </div>
      </li>
    );
  };

  const restRow = (item) => (
    <li className="pxItem" key={`${item.kind}-${item.id}`}>
      <div className="pxItemHead">
        <b>{item.service || "نوبت"}، {item.providerName || "سالن"}</b>
        <span>{when(item)}</span>
      </div>
      {item.confirmed ? null : <small>درخواست، هنوز جواب نگرفته</small>}
    </li>
  );

  if (!near.length && !rest.length) return null;
  return (
    <section className="pxPanel" aria-live="polite">
      {error ? <p className="pxAlert is-error">{error}</p> : null}
      {near.length ? (
        <>
          <p className="pxAlert">{clientBlockedText(near.length)}</p>
          <ul className="pxList">{near.map(nearRow)}</ul>
        </>
      ) : null}
      {rest.length ? (
        <>
          <p className={near.length ? "pxMuted" : "pxAlert"}>{clientRestText(rest)}</p>
          <ul className="pxList">{rest.map(restRow)}</ul>
        </>
      ) : null}
    </section>
  );
}
