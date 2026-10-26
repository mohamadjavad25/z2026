"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { CAPACITY_PRESETS, DAY_PRESETS, HOUR_RANGE_PRESETS, PresetRow, SHARE_PRESETS } from "../collab/collabPresets";

const TYPE_NAME = { salon: "سالن", artist: "آرتیست" };
const DEFAULT_TERMS = {
  days: DAY_PRESETS[0].value,
  from: HOUR_RANGE_PRESETS[0].from,
  to: HOUR_RANGE_PRESETS[0].to,
  share: SHARE_PRESETS[1].value,
  capacity: CAPACITY_PRESETS[1].value
};

/**
 * What a salon or artist sees at the bottom of another salon's or artist's public page (the page a scanned code
 * opens), in place of «رزرو» (owner's decision 2026-10-25):
 *  - a salon on an artist's page: «دعوت به تیمم», with the same term chips as the in-app invite;
 *  - an artist on a salon's page: «پیشنهاد همکاری», the same chips, sent as a collaboration proposal;
 *  - a salon on a salon's page, an artist on an artist's page: only a line saying they can only look.
 * Returns null for clients, guests and the page's own owner (they keep the normal page).
 */
export function businessVisitorKind(viewer, target) {
  if (!viewer || (viewer.type !== "salon" && viewer.type !== "artist")) return "";
  if (Number(viewer.id) === Number(target.id)) return "";
  if (viewer.type === target.type) return "same";
  return viewer.type === "salon" ? "invite" : "propose";
}

export function BusinessVisitorBar({ viewer, target }) {
  const kind = businessVisitorKind(viewer, target);
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }
  if (!kind) return null;

  if (kind === "same") {
    return (
      <nav className="spvBar bvBar" aria-label="این صفحه">
        <p className="bvNote">این صفحهٔ یه {TYPE_NAME[target.type]} دیگه‌ست؛ با حساب {TYPE_NAME[viewer.type]} نمی‌شه نوبت گرفت.</p>
      </nav>
    );
  }

  const isInvite = kind === "invite";
  const label = isInvite ? "دعوت به تیمم" : "پیشنهاد همکاری";
  const hourLabel = HOUR_RANGE_PRESETS.find((p) => p.from === terms.from && p.to === terms.to)?.label || "";

  async function send() {
    if (busy) return;
    setBusy(true);
    try {
      const body = isInvite
        ? { artistUserId: Number(target.id), ...terms }
        : {
          kind: "collab",
          salonId: Number(target.id),
          salonName: target.name || "سالن",
          area: target.area || "",
          service: viewer.service || "آرتیست",
          ...terms,
          status: "آماده ارسال"
        };
      const { ok, payload } = await apiFetch(isInvite ? "/api/salon-invites" : "/api/artist/me", { method: "POST", body: JSON.stringify(body) });
      setResult(ok
        ? { ok: true, text: isInvite ? `دعوت رفت؛ ${target.name} توی اعلان‌هاش می‌بینه و جواب می‌ده.` : `پیشنهادت رفت؛ ${target.name} توی اعلان‌هاش می‌بینه و جواب می‌ده.` }
        : { ok: false, text: payload?.error || "نرفت؛ دوباره بزن." });
      if (ok) setOpen(false);
    } catch {
      setResult({ ok: false, text: "نرفت؛ اینترنتت رو یه نگاه بنداز و دوباره بزن." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="bvSheet" role="dialog" aria-modal="true" aria-label={label}>
          <h3>{isInvite ? `${target.name} رو دعوت کن به تیمت` : `پیشنهاد همکاری به ${target.name}`}</h3>
          <p>{isInvite ? "شرط‌ها رو انتخاب کن؛ آرتیست می‌بینه و جواب می‌ده." : "شرط‌هات رو انتخاب کن؛ سالن می‌بینه و جواب می‌ده."}</p>
          <div className="bvField">
            <span>روزها</span>
            <PresetRow options={DAY_PRESETS} isSelected={(value) => terms.days === value} onPick={(value) => setTerms((t) => ({ ...t, days: value }))} />
          </div>
          <div className="bvField">
            <span>ساعت</span>
            <PresetRow
              options={HOUR_RANGE_PRESETS.map((p) => ({ label: p.label, value: p.label }))}
              isSelected={(value) => value === hourLabel}
              onPick={(value) => {
                const preset = HOUR_RANGE_PRESETS.find((p) => p.label === value);
                if (preset) setTerms((t) => ({ ...t, from: preset.from, to: preset.to }));
              }}
            />
          </div>
          <div className="bvField">
            <span>سهم آرتیست</span>
            <PresetRow options={SHARE_PRESETS} isSelected={(value) => terms.share === value} onPick={(value) => setTerms((t) => ({ ...t, share: value }))} />
          </div>
          <div className="bvField">
            <span>ظرفیت روزانه</span>
            <PresetRow options={CAPACITY_PRESETS} isSelected={(value) => terms.capacity === value} onPick={(value) => setTerms((t) => ({ ...t, capacity: value }))} />
          </div>
          {result && !result.ok ? <p className="bvResult is-error" role="alert">{result.text}</p> : null}
          <div className="bvActions">
            <button type="button" className="spvBarBook" disabled={busy} onClick={send}>
              <Send size={17} aria-hidden="true" />
              {busy ? "دارم می‌فرستم…" : "بفرست"}
            </button>
            <button type="button" className="bvCancel" onClick={() => { setOpen(false); setResult(null); }}>بعداً</button>
          </div>
        </div>
      ) : null}
      <nav className="spvBar bvBar" aria-label={label}>
        {result?.ok ? (
          <p className="bvResult is-done" role="status">{result.text}</p>
        ) : (
          <button type="button" className="spvBarBook" onClick={() => { setResult(null); setOpen(true); }}>
            <Send size={18} aria-hidden="true" />
            {label}
          </button>
        )}
      </nav>
    </>
  );
}
