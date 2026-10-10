"use client";

import { todayStatus } from "../../shared/lib/openingHours";

const TYPE_LABEL = { salon: "سالن", artist: "آرتیست" };

/** Round photo, or the first letter of the name on a soft tint. */
export function ConnectionAvatar({ profile, size = 50 }) {
  const shape = profile.type === "artist" ? "is-round" : "";
  if (profile.avatar) {
    return (
      <span className={`cnAvatar ${shape}`} style={{ width: size, height: size }} aria-hidden="true">
        <img src={profile.avatar} alt="" style={{ objectPosition: profile.avatarPosition || "50% 50%" }} />
      </span>
    );
  }
  return (
    <span className={`cnAvatar is-letter ${shape}`} style={{ width: size, height: size }} aria-hidden="true">
      {String(profile.name || "؟").trim().replace(/^(سالن|آتلیه)\s+/, "").slice(0, 1)}
    </span>
  );
}

/**
 * One salon/artist row: tapping the body opens the profile, the button on the
 * side does the main action (book, connect, ...).
 */
export function ConnectionCard({ profile, onOpen, action }) {
  const status = todayStatus(profile.hours);
  const details = [status?.label, profile.area || profile.specialty].filter(Boolean).join(" · ");
  return (
    <article className="cnCard">
      <button type="button" className="cnCardMain" onClick={() => onOpen?.(profile)} aria-label={`باز کردن ${profile.name}`}>
        <ConnectionAvatar profile={profile} />
        <span className="cnCardText">
          <span className="cnCardTitle">
            <b>{profile.name}</b>
            <em>{TYPE_LABEL[profile.type] || ""}</em>
          </span>
          {details ? (
            <small>
              {status ? <i className={`cnDot ${status.open ? "is-open" : ""}`} aria-hidden="true" /> : null}
              {details}
            </small>
          ) : null}
        </span>
      </button>
      {action}
    </article>
  );
}
