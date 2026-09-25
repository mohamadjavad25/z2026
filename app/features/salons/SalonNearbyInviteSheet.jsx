"use client";

import { useState } from "react";
import { Check, Copy, QrCode, Search, Send } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { useQrCode } from "../../shared/hooks/useQrCode";

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
  const joinUrl = open && salonId && typeof window !== "undefined"
    ? `${window.location.origin}/join-salon/${salonId}`
    : "";
  const qrDataUrl = useQrCode(joinUrl, open);

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
            return (
              <article className="artistInviteRow" key={artist.id || artist.name}>
                <span className={`artistInviteAvatar ${artist.avatar ? "hasImage" : ""}`} aria-hidden="true">
                  {artist.avatar ? <img src={artist.avatar} alt="" /> : String(artist.name || "آ").slice(0, 1)}
                </span>
                <div className="artistInviteCopy">
                  <b>{artist.name || "آرتیست زیبابان"}</b>
                  <span>
                    {artist.service || "آرتیست"}
                    {artist.area ? ` · ${artist.area}` : ""}
                  </span>
                  {artist.isNearby ? <em>نزدیک به محدوده سالن</em> : null}
                </div>
                <button
                  type="button"
                  className="artistInviteSend"
                  disabled={busy}
                  onClick={() => onInvite?.(artist)}
                >
                  <Send size={14} aria-hidden="true" />
                  {busy ? "..." : "دعوت"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="artistInviteEmpty">
          <Search size={18} aria-hidden="true" />
          آرتیست آزادی برای دعوت پیدا نشد.
        </div>
      )}
    </ProfileSheet>
  );
}
