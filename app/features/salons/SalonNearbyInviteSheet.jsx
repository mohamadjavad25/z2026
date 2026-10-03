"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, QrCode, Send } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { useQrCode } from "../../shared/hooks/useQrCode";
import { CAPACITY_PRESETS, DAY_PRESETS, HOUR_RANGE_PRESETS, PresetRow, SHARE_PRESETS } from "../collab/collabPresets";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceIconStrip } from "../../components/ServiceIconStrip";

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
        <section className="artistInviteQrCard" aria-label="پیوستن با کد QR">
          <div className="artistInviteQrHead">
            <span className="artistInviteQrIcon" aria-hidden="true">
              <QrCode size={16} />
            </span>
            <div>
              <b>سریع‌ترین راه</b>
              <span>کد رو به آرتیست نشون بده تا با اسکن، مستقیم به تیم بپیونده</span>
            </div>
          </div>
          <div className="artistInviteQrImage">
            {qrDataUrl ? <img src={qrDataUrl} alt={`کد پیوستن به تیم ${salonName}`} /> : null}
          </div>
          <button type="button" className="artistInviteQrCopy" onClick={copyJoinLink}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? "لینک کپی شد" : "کپی لینک پیوستن"}
          </button>
        </section>
      ) : null}

      <div className="artistInviteDivider">
        <span />
        <em>یا از بین آرتیست‌های نزدیک انتخاب کن</em>
        <span />
      </div>

      {loading ? (
        <div className="artistInviteEmpty">در حال پیدا کردن آرتیست‌های نزدیک...</div>
      ) : artists.length ? (
        <div className="artistInviteList" aria-label="لیست آرتیست‌های نزدیک">
          {artists.map((artist) => {
            const busy = String(busyId) === String(artist.id);
            const id = String(artist.id || artist.name);
            const expanded = expandedId === id;
            return (
              <div className="artistInviteEntry" key={id}>
                <article className="artistInviteRow">
                  <span className="artistInviteAvatar hasImage" aria-hidden="true">
                    <img src={artist.avatar || "/profile-icon.svg"} alt="" />
                  </span>
                  <div className="artistInviteCopy">
                    <b>{artist.name || "آرتیست زیبابان"}</b>
                    <span className="inviteRole">
                      <ServiceIcon name={artist.service} size="xs" />
                      {artist.service || "آرتیست"}
                      {artist.area ? ` · ${artist.area}` : ""}
                    </span>
                    {artist.isNearby ? <em>نزدیک به محدوده سالن</em> : null}
                  </div>
                  <button
                    type="button"
                    className={`artistInviteSend ${expanded ? "is-open" : ""}`}
                    disabled={busy}
                    onClick={() => toggleTerms(artist)}
                  >
                    {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                    {busy ? "..." : expanded ? "بستن" : "دعوت"}
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
        <div className="artistInviteEmpty is-lively">
          <ServiceIconStrip ids={["haircut", "manicure", "lipstick"]} size="md" />
          <b>آرتیست آزادی نزدیکت پیدا نشد</b>
          <span>کد QR بالا را برای آرتیست‌ها بفرست تا مستقیم به تیم بپیوندند.</span>
        </div>
      )}
    </ProfileSheet>
  );
}
