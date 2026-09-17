"use client";

import { Send } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";

/**
 * Salon owner — nearby artist invite sheet.
 * Presentational: nearby list + invite callback from useSalonWorkspace.
 */
export function SalonNearbyInviteSheet({
  open,
  loading = false,
  artists = [],
  busyId = "",
  onClose,
  onInvite
}) {
  return (
    <ProfileSheet
      open={open}
      kicker="پرسنل"
      title="آرتیست‌های نزدیک"
      label="دعوت آرتیست نزدیک"
      panelClassName="artistInviteSheet"
      onClose={onClose}
    >
      <p className="artistInviteSheetLead">
        آرتیست‌های هم‌محدوده اول نمایش داده می‌شوند. با دعوت، اعلان برای آرتیست ارسال می‌شود و تا تایید او نهایی نیست.
      </p>
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
        <div className="artistInviteEmpty">آرتیست آزادی برای دعوت پیدا نشد.</div>
      )}
    </ProfileSheet>
  );
}
