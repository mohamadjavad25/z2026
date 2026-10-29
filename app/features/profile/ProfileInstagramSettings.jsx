"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, Copy, X } from "lucide-react";
import { SheetBackHandler } from "../../components/SheetClose";
import { InstagramGlyph } from "../../components/InstagramFolder";
import { toPersianDigits } from "../../shared/lib/digits";
import { INSTAGRAM_INVALID_MESSAGE, normalizeInstagram } from "../../shared/lib/instagram";
import { InstagramStorySheet, loadFreeSlots, loadWorks } from "./InstagramStorySheet";

// Toasts are one line: short.
const BIO_COPIED = "کپی شد. حالا بذارش تو بیو اینستاگرامت.";

/** The pill on the story card: what is worth posting right now. */
function storyNews(slots) {
  if (!slots) return "";
  const [today, tomorrow] = slots;
  if (tomorrow?.times.length) return `${toPersianDigits(tomorrow.times.length)} وقت خالی برای فردا`;
  if (today?.times.length) return `${toPersianDigits(today.times.length)} وقت خالی برای امروز`;
  return "نمونه‌کارهات رو استوری کن";
}

/**
 * «اینستاگرام» in Settings for salons and artists. One row opens a short sheet from the bottom (owner's redesign
 * 2026-10-29): the page name (saving is for your own account, so violet), the link for the Instagram bio and the
 * «استوری آماده» card that opens the full-screen story maker (InstagramStorySheet). The saved page shows on the public
 * page as the Instagram folder (components/InstagramFolder). onSave(name) resolves to { ok, error }; "" removes the page.
 */
export function ProfileInstagramSettings({ profileType, profileId, name = "", avatar = "", value = "", saving = false, onSave, onNotify }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? `@${value}` : "");
  const [error, setError] = useState("");
  const [askClear, setAskClear] = useState(false);
  const [copied, setCopied] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [slots, setSlots] = useState(null);
  const [cover, setCover] = useState("");
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => { if (!open) setDraft(value ? `@${value}` : ""); }, [value, open]);

  // The story card's news and its little picture, read when the sheet opens.
  useEffect(() => {
    if (!open || !profileId) return undefined;
    let cancelled = false;
    loadFreeSlots(profileType, profileId).then((days) => { if (!cancelled) setSlots(days); }).catch(() => { if (!cancelled) setSlots([]); });
    loadWorks().then((list) => { if (!cancelled) setCover(list[0]?.src || ""); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, profileType, profileId]);

  // Focus moves into the sheet, Escape closes it, and focus goes back to the row afterwards.
  useEffect(() => {
    if (!open || storyOpen) return undefined;
    const opener = document.activeElement;
    const raf = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    const onKey = (event) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, storyOpen]);

  if (profileType !== "salon" && profileType !== "artist") return null;
  const publicPath = `/${profileType === "salon" ? "salons" : "artists"}/${Number(profileId)}`;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;
  const shownUrl = publicUrl.replace(/^https?:\/\//, "");
  const example = profileType === "salon" ? "salon.roz" : "negar.nails";
  const changed = (normalizeInstagram(draft) ?? draft) !== value;
  const firstFree = slots?.find((day) => day.times.length)?.times[0] || "";

  function close() {
    setOpen(false);
    setError("");
  }

  async function save() {
    const next = normalizeInstagram(draft);
    if (next === null) {
      setError(INSTAGRAM_INVALID_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    setError("");
    if (next === value) return;
    const result = await onSave?.(next);
    if (result?.ok) {
      setDraft(next ? `@${next}` : "");
      onNotify?.(next ? "پیجت وصل شد." : "پیجت برداشته شد.");
    } else if (result?.error) {
      setError(result.error);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      onNotify?.(BIO_COPIED);
    } catch {
      onNotify?.("کپی نشد؛ لینک رو نگه دار و کپی کن.");
    }
  }

  const sheet = open && !askClear && !storyOpen && typeof document !== "undefined" ? createPortal((
    <div className="igSheetBackdrop" role="dialog" aria-modal="true" aria-label="اینستاگرام" onClick={close}>
      <div className="igSheet" ref={panelRef} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <span className="igSheetGrab" aria-hidden="true" />
        <div className="igSheetHead">
          <span className="igSheetLogo" aria-hidden="true"><InstagramGlyph size={18} /></span>
          <h3>اینستاگرام</h3>
          <button type="button" className="igSheetClose" onClick={close} aria-label="بستن اینستاگرام"><X size={17} /></button>
        </div>

        <div className={`igSettingsField${error ? " is-error" : ""}`} dir="ltr">
          <span aria-hidden="true">@</span>
          <input
            id="igSettingsInput"
            ref={inputRef}
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder={example}
            value={draft.replace(/^@+/, "")}
            onChange={(e) => { setDraft(e.target.value); if (error) setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            aria-label="اسم پیج اینستاگرامت"
            aria-invalid={Boolean(error)}
            aria-describedby="igSettingsHelp"
          />
          {changed ? (
            <button type="button" className="igSettingsSave" disabled={saving} onClick={save}>{saving ? "صبر کن…" : "ذخیره"}</button>
          ) : value ? <Check size={18} className="igSettingsSaved" aria-label="ذخیره شده" /> : null}
        </div>
        <p className={error ? "igSettingsError" : "igSettingsHelp"} id="igSettingsHelp" role={error ? "alert" : undefined}>
          {error || `اسم پیجت یا لینکش رو بزن، مثلا ${example}`}
        </p>

        <div className="igSettingsBio">
          <div className="igSettingsBioText">
            <small>لینک بیو</small>
            <span dir="ltr">{shownUrl}</span>
          </div>
          <button type="button" className={`igSettingsCopy${copied ? " is-done" : ""}`} onClick={copyLink}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? "کپی شد" : "کپی لینک"}
          </button>
        </div>
        <p className="igSettingsHelp">بذارش تو بیو؛ دنبال‌کننده‌هات با یه لمس نوبت می‌گیرن.</p>

        <button type="button" className="igSettingsStory" onClick={() => setStoryOpen(true)}>
          <span className="igSettingsStoryText">
            <strong>استوری آماده</strong>
            {slots ? <em>{storyNews(slots)}</em> : <em className="is-wait">یه لحظه…</em>}
            <span className="igSettingsStoryGo">بساز <ChevronLeft size={15} aria-hidden="true" /></span>
          </span>
          <span className="igSettingsStoryThumbs" aria-hidden="true">
            <span className="igSettingsStoryThumb is-time">{firstFree ? toPersianDigits(firstFree) : ""}</span>
            <span className="igSettingsStoryThumb is-work" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} />
          </span>
        </button>
        <SheetBackHandler onClose={close} />
      </div>
    </div>
  ), document.body) : null;

  return (
    <section className="igSettings" aria-label="اینستاگرام">
      {askClear ? (
        <div className="profileLocationAsk" role="alertdialog" aria-label="برداشتن پیج اینستاگرام">
          <strong>پیج اینستاگرامت از صفحه‌ت برداشته بشه؟</strong>
          <span>پوشه‌ی اینستاگرام از صفحه‌ت می‌ره.</span>
          <div>
            <button type="button" className="profileLocationAskYes" disabled={saving} onClick={async () => { const r = await onSave?.(""); if (r?.ok) setAskClear(false); }}>آره، بردار</button>
            <button type="button" className="profileLocationAskNo" onClick={() => setAskClear(false)}>نه، بمونه</button>
          </div>
        </div>
      ) : (
        <button type="button" className="profileLocationRow" onClick={() => { setOpen(true); setError(""); }} aria-haspopup="dialog">
          <span className="profileLocationRowIcon igSettingsIcon" aria-hidden="true">
            <InstagramGlyph size={17} />
          </span>
          <span className="profileLocationRowInfo">
            <strong>اینستاگرام</strong>
            {value
              ? <span className="igSettingsHandle" dir="ltr">@{value}</span>
              : <span>پیجت رو وصل کن</span>}
          </span>
          {value ? (
            <span
              role="button"
              tabIndex={0}
              className="profileLocationRowClear"
              onClick={(e) => { e.stopPropagation(); setAskClear(true); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setAskClear(true); } }}
              aria-label="برداشتن پیج اینستاگرام"
            >
              <X size={13} />
            </span>
          ) : (
            <ChevronLeft size={16} className="profileLocationRowChevron igSettingsChevron" aria-hidden="true" />
          )}
        </button>
      )}

      {sheet}
      <InstagramStorySheet open={storyOpen} name={name} avatar={avatar} profileType={profileType} profileId={profileId} url={publicUrl} onClose={() => setStoryOpen(false)} onNotify={onNotify} />
    </section>
  );
}
