"use client";

import { useMemo, useState } from "react";
import { TermsProposalSheet } from "../team/TermsProposalSheet";
import { toPersianDigits } from "../../shared/lib/digits";
import { saveSalonJoinTerms } from "../../shared/api/joinTerms";
import { DEFAULT_JOIN_TERMS, termsSummary } from "./joinTermsFormat";

/**
 * «شرایط همکاری» under the QR in the add-artist sheet: one summary line, how many rules the salon wrote, and «ویرایش».
 * `terms` is null until the salon has saved them once; then the parent shows the pink prompt instead (`JoinTermsPrompt`)
 * and this card's sheet opens pre-filled with the defaults. Saving hands the saved terms back through `onSaved`.
 */
export function JoinTermsCard({ terms, rulesCount = 0, sheetOpen, onSheetOpenChange, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initial = useMemo(() => terms || DEFAULT_JOIN_TERMS, [terms]);

  async function save(next) {
    setBusy(true);
    setError("");
    try {
      const result = await saveSalonJoinTerms({
        days: next.days,
        from: next.from,
        to: next.to,
        share: next.share,
        ownShare: next.ownShare,
        allowProposals: next.allowProposals
      });
      if (!result.ok) {
        setError(result.payload?.error || "نشد؛ دوباره بزن.");
        return;
      }
      onSaved?.(result.data?.terms || { ...next });
      onSheetOpenChange(false);
    } catch {
      setError("نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {terms ? (
        <section className="jtCard" aria-label="شرایط همکاری">
          <div className="jtHead">
            <b>شرایط همکاری</b>
            <span className="jtChip">تازه</span>
          </div>
          <p className="jtSummary">{termsSummary(terms)}</p>
          <div className="jtFoot">
            <small>{rulesCount ? `قوانین سالن: ${toPersianDigits(rulesCount)} بند` : "قوانین سالن: ننوشتی"}</small>
            <button type="button" className="jtEdit" onClick={() => { setError(""); onSheetOpenChange(true); }}>ویرایش</button>
          </div>
        </section>
      ) : null}
      <TermsProposalSheet
        mode="salon"
        open={sheetOpen}
        otherName="آرتیست"
        initial={initial}
        busy={busy}
        error={error}
        onSend={save}
        onClose={() => { onSheetOpenChange(false); setError(""); }}
      />
    </>
  );
}

/** Shown instead of the QR until the terms are saved. */
export function JoinTermsPrompt({ onOpen }) {
  return (
    <section className="jtPrompt" aria-label="اول شرایط همکاری">
      <p>اول شرایط همکاری رو ببین و ذخیره کن، بعد کد رو بفرست.</p>
      <button type="button" onClick={onOpen}>شرایط رو ببین</button>
    </section>
  );
}
