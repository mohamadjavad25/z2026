"use client";

import { ConnectSheet } from "./ConnectSheet";
import { ConnectionAvatar } from "./ConnectionCard";

/**
 * Several of the client's salons and artists do the service picked: one tap opens that place on it. The link under
 * them asks someone else, from the contacts (ContactRequestFlow).
 */
export function PlacesSheet({ service, matches = [], onOpen, onOther, onClose }) {
  return (
    <ConnectSheet label={service.name} title={service.name} subtitle="کجا بری؟" onClose={onClose}>
      <div className="cnPicks">
        {matches.map((profile) => (
          <article className="cnPick" key={profile.id}>
            <button type="button" className="cnPickMain" onClick={() => onOpen?.(profile)} aria-label={`رزرو از ${profile.name}`}>
              <ConnectionAvatar profile={profile} size={46} />
              <span className="cnPickText">
                <b>{profile.name}</b>
                <small>{(profile.services || []).slice(0, 3).join(" · ")}</small>
              </span>
            </button>
            <button type="button" className="crBookBtn" onClick={() => onOpen?.(profile)}>رزرو</button>
          </article>
        ))}
      </div>
      <button type="button" className="cnSheetMore" onClick={onOther}>سالن یا آرتیست دیگه می‌خوام</button>
    </ConnectSheet>
  );
}
