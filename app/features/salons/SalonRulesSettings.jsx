"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ScrollText } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { getSalonRules, saveSalonRules } from "../../shared/api/salons";
import { ProfileSheet } from "../profile/ProfileSheet";

const MAX_LENGTH = 2000;

const PLACEHOLDER = [
  "مثال:",
  "• لغو نوبت تا ۲۴ ساعت قبل بدون هزینه است.",
  "• تاخیر بیش از ۱۵ دقیقه ممکن است باعث لغو نوبت شود.",
  "• پیش‌پرداخت برای خدمات بلند الزامی است."
].join("\n");

/**
 * Settings row + editor sheet where the salon writes its rules & terms.
 * Saved text is shown to clients on the public salon page ("درباره سالن").
 */
export function SalonRulesSettings({ onNotify }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSalonRules()
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok) setSaved(String(data?.rules || ""));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openEditor() {
    setDraft(saved);
    setOpen(true);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const { ok, data, payload } = await saveSalonRules(draft);
      if (!ok) {
        onNotify?.(payload?.error || "ذخیره قوانین انجام نشد.");
        return;
      }
      setSaved(String(data?.rules ?? draft.trim()));
      setOpen(false);
      onNotify?.("قوانین و شرایط سالن ذخیره شد.");
    } catch {
      onNotify?.("ذخیره قوانین انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setSaving(false);
    }
  }

  const lineCount = saved ? saved.split("\n").filter((line) => line.trim()).length : 0;

  return (
    <>
      <div className="settingsRowCard">
        <button type="button" className="profileLocationRow" onClick={openEditor} disabled={!loaded}>
          <span className="profileLocationRowIcon" aria-hidden="true">
            <ScrollText size={17} />
          </span>
          <span className="profileLocationRowInfo">
            <strong>قوانین و شرایط سالن</strong>
            <span>{saved ? `${toPersianDigits(lineCount)} بند ثبت‌شده` : "هنوز قانونی ننوشته‌ای"}</span>
          </span>
          <ChevronLeft size={16} className="profileLocationRowChevron" aria-hidden="true" />
        </button>
      </div>

      <ProfileSheet
        open={open}
        kicker="تنظیمات سالن"
        title="قوانین و شرایط"
        label="قوانین و شرایط سالن"
        panelClassName="salonRulesSheet"
        onClose={() => (saving ? null : setOpen(false))}
      >
        <p className="salonRulesHint">
          هر بند را در یک خط بنویس. این متن در صفحه عمومی سالن به مشتری‌ها نمایش داده می‌شود.
        </p>
        <textarea
          className="salonRulesInput"
          value={draft}
          maxLength={MAX_LENGTH}
          rows={10}
          placeholder={PLACEHOLDER}
          onChange={(event) => setDraft(event.target.value)}
          disabled={saving}
        />
        <div className="salonRulesFoot">
          <small>{toPersianDigits(draft.length)} / {toPersianDigits(MAX_LENGTH)}</small>
          <button type="button" className="imagePositionSave" onClick={handleSave} disabled={saving}>
            <Check size={14} aria-hidden="true" />
            {saving ? "..." : "ذخیره"}
          </button>
        </div>
      </ProfileSheet>
    </>
  );
}
