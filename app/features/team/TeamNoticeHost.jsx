"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, UserPlus, UsersRound } from "lucide-react";
import { apiFetch } from "../../shared/api/client";

/**
 * «همکاری تموم شد» (owner's decision 2026-10-25): when a salon takes an artist off its team, or an artist leaves one,
 * the other side sees this card the next time the app is open (or comes back to the front), until «باشه».
 * The push and the SMS go from the server (lib/teamNotify.js); this is the part that never gets lost.
 */
export function TeamNoticeHost({ profileType, onOpenTeam }) {
  const [notices, setNotices] = useState([]);
  const enabled = profileType === "salon" || profileType === "artist";

  const load = useCallback(async () => {
    try {
      const { ok, payload } = await apiFetch("/api/team-notices");
      if (ok) setNotices(Array.isArray(payload?.data?.notices) ? payload.data.notices : []);
    } catch {
      // shown on the next open
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, load]);

  const notice = enabled ? notices[0] : null;
  if (!notice) return null;

  const close = () => {
    setNotices((list) => list.filter((item) => item.id !== notice.id));
    apiFetch("/api/team-notices", { method: "POST", body: JSON.stringify({ ids: [notice.id] }) }).catch(() => {});
  };

  // «اومد توی تیمت» (2026-11-04): the start of a team, same card; its main button opens the team.
  const joined = notice.kind === "joined";
  if (joined || notice.kind === "accepted") {
    const open = () => {
      close();
      onOpenTeam?.();
    };
    return (
      <div className="teamNoticeBackdrop" role="presentation">
        <section className="teamNotice" role="alertdialog" aria-modal="true" aria-labelledby="teamNoticeTitle">
          <span className="teamNoticeIcon" aria-hidden="true"><UserPlus size={26} /></span>
          <h3 id="teamNoticeTitle">{joined ? `${notice.fromName} اومد توی تیمت` : `حالا توی تیم ${notice.fromName} هستی`}</h3>
          <p>{joined ? "از الان نوبت‌ها رو می‌تونی به اسمش ثبت کنی." : "روزها و ساعتت توی «همکاری» هست."}</p>
          <div className="teamNoticeActions">
            <button type="button" className="is-main" onClick={open}>{joined ? "ببینمش" : "ببینم"}</button>
            <button type="button" onClick={close}>باشه</button>
          </div>
        </section>
      </div>
    );
  }

  const gone = notice.kind === "gone";
  const removed = notice.kind === "removed" || gone;
  const title = removed ? `همکاری با ${notice.fromName} تموم شد` : `${notice.fromName} از تیمت رفت`;
  const text = gone
    ? `${notice.fromName} حسابش رو پاک کرد. نوبت‌های خودت سر جاشونن.`
    : removed
    ? `${notice.fromName} تو رو از تیمش برداشت. نوبت‌های خودت سر جاشونن.`
    : "دیگه توی تیمت نیست و نوبت تازه‌ای به اسمش نمیاد.";

  return (
    <div className="teamNoticeBackdrop" role="presentation">
      <section className="teamNotice" role="alertdialog" aria-modal="true" aria-labelledby="teamNoticeTitle">
        <span className="teamNoticeIcon" aria-hidden="true"><UsersRound size={26} /></span>
        <h3 id="teamNoticeTitle">{title}</h3>
        <p>{text}</p>
        {notice.reason ? <blockquote>«{notice.reason}»</blockquote> : null}
        <div className="teamNoticeActions">
          <button type="button" className="is-main" onClick={close}>باشه</button>
          {notice.fromPhone ? (
            <a href={`tel:${notice.fromPhone}`} onClick={close}>
              <Phone size={16} aria-hidden="true" />
              {removed ? "تماس با سالن" : "تماس با آرتیست"}
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
