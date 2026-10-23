"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Landmark } from "lucide-react";
import { applyRole } from "../../../shared/lib/theme";
import { formatToman } from "../../../shared/lib/money";

/**
 * Stands in for the bank's page while no real gateway is connected: the same two outcomes a real bank page has.
 * Pressing one records the answer on the server and sends the payer back through the normal callback, so everything
 * after this page is exactly what a real payment goes through.
 */
export function SandboxBankClient({ authority }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    applyRole("salon");
    let live = true;
    fetch(`/api/billing/sandbox/${encodeURIComponent(authority)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!live) return;
        if (response.ok) setInfo(payload.data);
        else setError(payload?.error || "این پرداخت آزمایشی پیدا نشد.");
      })
      .catch(() => live && setError("اینترنت قطعه؛ دوباره بزن."));
    return () => {
      live = false;
    };
  }, [authority]);

  async function answer(action) {
    setBusy(action);
    setError("");
    try {
      const response = await fetch(`/api/billing/sandbox/${encodeURIComponent(authority)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "انجام نشد.");
      window.location.assign(payload.data.redirect);
    } catch (err) {
      setError(err.message || "انجام نشد.");
      setBusy("");
    }
  }

  return (
    <main className="payPage">
      <section className="payCard is-bank">
        <p className="payTest is-strong"><FlaskConical size={15} aria-hidden="true" /> درگاه آزمایشی؛ این صفحهٔ بانک واقعی نیست و هیچ پولی جابه‌جا نمی‌شود.</p>
        <span className="payIcon"><Landmark size={32} aria-hidden="true" /></span>
        <h1>پرداخت به فرفرو</h1>
        {info ? (
          <>
            <dl className="payFacts">
              <div><dt>بابت</dt><dd>{info.title}</dd></div>
              <div><dt>مبلغ</dt><dd>{formatToman(info.amountToman)}</dd></div>
            </dl>
            {info.status === "pending" ? (
              <div className="payButtons">
                <button type="button" className="payAction" disabled={Boolean(busy)} onClick={() => answer("pay")}>
                  {busy === "pay" ? "در حال پرداخت…" : "پرداخت موفق"}
                </button>
                <button type="button" className="payAction is-secondary" disabled={Boolean(busy)} onClick={() => answer("cancel")}>
                  {busy === "cancel" ? "در حال بازگشت…" : "انصراف از پرداخت"}
                </button>
              </div>
            ) : (
              <p>این پرداخت قبلاً تموم شده.</p>
            )}
          </>
        ) : null}
        {!info && !error ? <p>در حال بارگذاری…</p> : null}
        {error ? <p className="payError" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
