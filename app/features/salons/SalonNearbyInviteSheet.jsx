"use client";

import { useState } from "react";
import { Check, Copy, MapPin, Send, Share2 } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileSheet } from "../profile/ProfileSheet";
import { useQrCode } from "../../shared/hooks/useQrCode";
import { CAPACITY_PRESETS, DAY_PRESETS, HOUR_RANGE_PRESETS, PresetRow, SHARE_PRESETS } from "../collab/collabPresets";
import { ServiceIcon } from "../../components/ServiceIcon";

const DEFAULT_TERMS = {
  days: DAY_PRESETS[2].value,
  from: HOUR_RANGE_PRESETS[0].from,
  to: HOUR_RANGE_PRESETS[0].to,
  share: SHARE_PRESETS[1].value,
  capacity: CAPACITY_PRESETS[1].value
};

/** Light, tap-only terms picker shown before a salon-sent invite goes out —
 *  every field starts pre-filled with a sensible default so confirming
 *  needs no typing at all; the chips are only there to adjust it. */
function InviteTermsPanel({ terms, onChange, onConfirm, onCancel, busy }) {
  const hourLabel = HOUR_RANGE_PRESETS.find((p) => p.from === terms.from && p.to === terms.to)?.label
    || `${terms.from} تا ${terms.to}`;
  return (
    <div className="artistInviteTermsPanel">
      <div className="artistInviteTermsField">
        <span>روزها</span>
        <PresetRow
          options={DAY_PRESETS}
          isSelected={(value) => terms.days === value}
          onPick={(value) => onChange({ days: value })}
        />
      </div>
      <div className="artistInviteTermsField">
        <span>ساعت</span>
        <PresetRow
          options={HOUR_RANGE_PRESETS.map((p) => ({ label: p.label, value: p.label }))}
          isSelected={(value) => value === hourLabel}
          onPick={(value) => {
            const preset = HOUR_RANGE_PRESETS.find((p) => p.label === value);
            if (preset) onChange({ from: preset.from, to: preset.to });
          }}
        />
      </div>
      <div className="artistInviteTermsField">
        <span>سهم آرتیست</span>
        <PresetRow
          options={SHARE_PRESETS}
          isSelected={(value) => terms.share === value}
          onPick={(value) => onChange({ share: value })}
        />
      </div>
      <div className="artistInviteTermsField">
        <span>ظرفیت روزانه</span>
        <PresetRow
          options={CAPACITY_PRESETS}
          isSelected={(value) => terms.capacity === value}
          onPick={(value) => onChange({ capacity: value })}
        />
      </div>
      <div className="artistInviteTermsActions">
        <button type="button" className="artistInviteTermsCancel" onClick={onCancel}>
          انصراف
        </button>
        <button type="button" className="artistInviteSend" disabled={busy} onClick={onConfirm}>
          <Send size={14} aria-hidden="true" />
          {busy ? "..." : "ارسال دعوت"}
        </button>
      </div>
    </div>
  );
}

/**
 * Salon owner — add-artist sheet: QR/link join (fast, in-person — the artist
 * scans and lands on /join-salon/[id] already knowing who they're joining)
 * plus the search-based nearby-artist invite list as a fallback for artists
 * who aren't standing in front of the owner.
 */
export function SalonNearbyInviteSheet({
  open,
  loading = false,
  artists = [],
  busyId = "",
  salonId,
  salonName = "سالن",
  onClose,
  onInvite
}) {
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const joinUrl = open && salonId && typeof window !== "undefined"
    ? `${window.location.origin}/join-salon/${salonId}`
    : "";
  const qrDataUrl = useQrCode(joinUrl, open);

  function toggleTerms(artist) {
    const id = String(artist.id || artist.name);
    if (expandedId === id) {
      setExpandedId("");
      return;
    }
    setTerms(DEFAULT_TERMS);
    setExpandedId(id);
  }

  function confirmInvite(artist) {
    onInvite?.(artist, terms);
    setExpandedId("");
  }

  async function copyJoinLink() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard permission denied or unavailable — the QR still works
    }
  }

  // One tap to send the join link through any installed messenger; falls back to copying it.
  async function shareJoinLink() {
    if (!joinUrl) return;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: salonName, text: `برای پیوستن به تیم «${salonName}» در Farfaroo این لینک را باز کن:`, url: joinUrl });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    copyJoinLink();
  }

  return (
    <ProfileSheet
      open={open}
      kicker="پرسنل"
      title="افزودن آرتیست"
      label="افزودن آرتیست به تیم"
      panelClassName="artistInviteSheet"
      onClose={onClose}
    >
      {salonId ? (
        <section className="ivtHero" aria-label="پیوستن با کد QR">
          <p className="ivtEyebrow">سریع‌ترین راه</p>
          <h4 className="ivtTitle">با یک اسکن، آرتیست وارد تیم می‌شود</h4>
          <div className="ivtScan">
            <span className="ivtCorner is-tl" aria-hidden="true" />
            <span className="ivtCorner is-tr" aria-hidden="true" />
            <span className="ivtCorner is-bl" aria-hidden="true" />
            <span className="ivtCorner is-br" aria-hidden="true" />
            <div className="ivtQr">
              {qrDataUrl ? <img src={qrDataUrl} alt={`کد پیوستن به تیم ${salonName}`} /> : <span className="ivtQrWait" />}
            </div>
          </div>
          <p className="ivtHint">کد را به آرتیست نشان بده، یا لینک را برایش بفرست.</p>
          <div className="ivtActions">
            <button type="button" className="ivtShare" onClick={shareJoinLink}>
              <Share2 size={17} aria-hidden="true" />
              ارسال لینک
            </button>
            <button type="button" className={`ivtCopyBtn ${copied ? "is-done" : ""}`} onClick={copyJoinLink} aria-label={copied ? "کپی شد" : "کپی لینک"}>
              {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
              <span>{copied ? "کپی شد" : "کپی"}</span>
            </button>
          </div>
        </section>
      ) : null}

      <div className="ivtSectionHead">
        <h4>آرتیست‌های نزدیک</h4>
        {artists.length ? <span className="ivtCount">{toPersianDigits(artists.length)}</span> : null}
      </div>

      {loading ? (
        <div className="ivtEmpty">
          <span className="ivtEmptyIcon" aria-hidden="true"><MapPin size={22} /></span>
          <b>در حال پیدا کردن آرتیست‌های اطراف…</b>
        </div>
      ) : artists.length ? (
        <div className="ivtList" aria-label="لیست آرتیست‌های نزدیک">
          {artists.map((artist) => {
            const busy = String(busyId) === String(artist.id);
            const id = String(artist.id || artist.name);
            const expanded = expandedId === id;
            return (
              <div className={`ivtEntry ${expanded ? "is-open" : ""}`} key={id}>
                <article className="ivtRow">
                  <span className="ivtAvatar" aria-hidden="true">
                    <img src={artist.avatar || "/profile-icon.svg"} alt="" />
                  </span>
                  <div className="ivtCopy">
                    <b>{artist.name || "آرتیست Farfaroo"}</b>
                    <span className="ivtRole">
                      <ServiceIcon name={artist.service} size="xs" />
                      {artist.service || "آرتیست"}
                      {artist.area ? ` • ${artist.area}` : ""}
                    </span>
                    {artist.isNearby ? <em className="ivtNear"><MapPin size={11} aria-hidden="true" />نزدیک سالن</em> : null}
                  </div>
                  <button
                    type="button"
                    className={`ivtInvite ${expanded ? "is-open" : ""}`}
                    disabled={busy}
                    aria-expanded={expanded}
                    onClick={() => toggleTerms(artist)}
                  >
                    {busy ? "…" : expanded ? "بستن" : "دعوت"}
                  </button>
                </article>
                {expanded ? (
                  <InviteTermsPanel
                    terms={terms}
                    onChange={(patch) => setTerms((current) => ({ ...current, ...patch }))}
                    onConfirm={() => confirmInvite(artist)}
                    onCancel={() => setExpandedId("")}
                    busy={busy}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ivtEmpty">
          <span className="ivtEmptyIcon" aria-hidden="true"><MapPin size={22} /></span>
          <b>هنوز آرتیست آزادی نزدیکت نیست</b>
          <span>لینک یا کد بالا را بفرست تا مستقیم به تیم بپیوندد.</span>
        </div>
      )}
    </ProfileSheet>
  );
}
