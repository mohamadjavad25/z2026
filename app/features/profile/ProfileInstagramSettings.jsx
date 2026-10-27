"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Copy, ImageDown, X } from "lucide-react";
import { InstagramGlyph } from "../../components/InstagramFolder";
import { INSTAGRAM_INVALID_MESSAGE, normalizeInstagram } from "../../shared/lib/instagram";
import { InstagramStorySheet } from "./InstagramStorySheet";

// Toasts are one line: short.
const BIO_COPIED = "کپی شد. حالا بذارش تو بیو اینستاگرامت.";

/**
 * «اینستاگرام» in Settings for salons and artists (owner's choice 2026-10-27, «۲»): one row that opens the page
 * name field, the link of their public page for the Instagram bio («کپی لینک») and «استوری آماده» (a ready
 * 9:16 picture with a QR, InstagramStorySheet). The saved page shows on the public page as the Instagram folder
 * (components/InstagramFolder: on the cover and after the works for a salon, a row under the hours for an artist). onSave(name) resolves to { ok, error }; "" removes the page.
 */
export function ProfileInstagramSettings({ profileType, profileId, name = "", value = "", saving = false, onSave, onNotify }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? `@${value}` : "");
  const [error, setError] = useState("");
  const [askClear, setAskClear] = useState(false);
  const [copied, setCopied] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (!open) setDraft(value ? `@${value}` : ""); }, [value, open]);

  if (profileType !== "salon" && profileType !== "artist") return null;
  const publicPath = `/${profileType === "salon" ? "salons" : "artists"}/${Number(profileId)}`;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;
  const shownUrl = publicUrl.replace(/^https?:\/\//, "");
  const example = profileType === "salon" ? "salon.roz" : "negar.nails";

  async function save() {
    const next = normalizeInstagram(draft);
    if (next === null) {
      setError(INSTAGRAM_INVALID_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    setError("");
    if (next === value) { setOpen(false); return; }
    const result = await onSave?.(next);
    if (result?.ok) {
      setDraft(next ? `@${next}` : "");
      setOpen(false);
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

  return (
    <section className="igSettings" aria-label="اینستاگرام">
      {askClear ? (
        <div className="profileLocationAsk" role="alertdialog" aria-label="برداشتن پیج اینستاگرام">
          <strong>پیج اینستاگرامت از صفحه‌ت برداشته بشه؟</strong>
          <span>دکمه‌ی اینستاگرام از کنار اسمت می‌ره.</span>
          <div>
            <button type="button" className="profileLocationAskYes" disabled={saving} onClick={async () => { const r = await onSave?.(""); if (r?.ok) setAskClear(false); }}>آره، بردار</button>
            <button type="button" className="profileLocationAskNo" onClick={() => setAskClear(false)}>نه، بمونه</button>
          </div>
        </div>
      ) : (
        <button type="button" className="profileLocationRow" onClick={() => { setOpen((v) => !v); setError(""); }} aria-expanded={open}>
          <span className="profileLocationRowIcon igSettingsIcon" aria-hidden="true">
            <InstagramGlyph size={17} />
          </span>
          <span className="profileLocationRowInfo">
            <strong>اینستاگرام</strong>
            {value
              ? <span className="igSettingsHandle" dir="ltr">@{value}</span>
              : <span>پیجت رو بذار تا مشتری‌ها کارهات رو اونجا هم ببینن</span>}
          </span>
          {value && !open ? (
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
            <ChevronLeft size={16} className={`profileLocationRowChevron igSettingsChevron${open ? " is-open" : ""}`} aria-hidden="true" />
          )}
        </button>
      )}

      {open && !askClear ? (
        <div className="igSettingsPanel">
          <label className="igSettingsLabel" htmlFor="igSettingsInput">اسم پیجت</label>
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
              aria-invalid={Boolean(error)}
              aria-describedby="igSettingsHelp"
            />
          </div>
          <p className={error ? "igSettingsError" : "igSettingsHelp"} id="igSettingsHelp" role={error ? "alert" : undefined}>
            {error || `اسم پیج یا لینکش رو بنویس، مثلا ${example}`}
          </p>
          <div className="igSettingsButtons">
            <button type="button" className="igSettingsSave" disabled={saving} onClick={save}>{saving ? "صبر کن…" : "ذخیره"}</button>
            <button type="button" className="igSettingsCancel" onClick={() => { setOpen(false); setError(""); }}>بی‌خیال</button>
          </div>

          <div className="igSettingsBio">
            <p>لینک صفحه‌ت رو بذار تو بیو اینستاگرام، دنبال‌کننده‌هات با یه لمس نوبت می‌گیرن.</p>
            <div className="igSettingsLink" dir="ltr">{shownUrl}</div>
            <div className="igSettingsBioButtons">
              <button type="button" className={`igSettingsCopy${copied ? " is-done" : ""}`} onClick={copyLink}>
                {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                {copied ? "کپی شد" : "کپی لینک"}
              </button>
              <button type="button" className="igSettingsStory" onClick={() => setStoryOpen(true)}>
                <ImageDown size={17} aria-hidden="true" />
                استوری آماده
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <InstagramStorySheet open={storyOpen} name={name} url={publicUrl} onClose={() => setStoryOpen(false)} onNotify={onNotify} />
    </section>
  );
}
