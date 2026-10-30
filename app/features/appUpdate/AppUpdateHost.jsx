"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { onAppUpdateAsked, openStorePage } from "../../shared/lib/appUpdate";
import { installAppShare } from "../../shared/lib/appShare";
import { useAppUpdate } from "./useAppUpdate";

const SITE = "frfro.ir";

// Before any screen mounts, so share buttons that look for navigator.share find the app's.
installAppShare();

/**
 * The one place that asks people to update the Android app (owner's choice 2026-10-30: the character with a short line).
 *  - A button the app is too old for calls askForAppUpdate(reason): if the new build is on Cafe Bazaar the sheet sends
 *    them there; if it is still in Bazaar's review, it says so and points to the site in the browser, never to an update
 *    that is not there yet.
 *  - The pill at the top (AppUpdatePill) opens the same sheet.
 *  - When the admin panel makes the update a must, older builds see only the full screen.
 * Mounted once in the root layout; outside the Android app it renders nothing.
 */
export function AppUpdateHost() {
  const update = useAppUpdate();
  const [ask, setAsk] = useState(null);
  const [copied, setCopied] = useState(false);

  // Again once mounted, in case the app's bridge arrived after this file loaded.
  useEffect(() => { installAppShare(); }, []);

  useEffect(() => onAppUpdateAsked((detail) => {
    setCopied(false);
    setAsk(detail);
  }), []);

  const close = () => setAsk(null);
  useBackHandler(Boolean(ask) && !update.forced, close);

  if (typeof document === "undefined") return null;

  if (update.forced) {
    return createPortal((
      <div className="appUpd is-forced" role="dialog" aria-modal="true" aria-labelledby="appUpdTitle">
        <div className="appUpdCard">
          <img className="appUpdMascot" src="/brand/mascot/update.webp" width="160" height="180" alt="" aria-hidden="true" />
          <h2 id="appUpdTitle">اول فرفرو رو به‌روز کن</h2>
          <p>این نسخهٔ اپ دیگه درست کار نمی‌کنه. به‌روزش کن؛ یه دقیقه طول می‌کشه.</p>
          <button type="button" className="appUpdMain" onClick={openStorePage}>به‌روزرسانی از کافه‌بازار</button>
        </div>
      </div>
    ), document.body);
  }

  if (!ask) return null;

  async function copySite() {
    try {
      await navigator.clipboard.writeText(`https://${SITE}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const live = update.available;
  return createPortal((
    <div className="appUpd" role="dialog" aria-modal="true" aria-labelledby="appUpdTitle" onClick={close}>
      <div className="appUpdCard is-sheet" onClick={(event) => event.stopPropagation()}>
        <span className="appUpdGrab" aria-hidden="true" />
        <img className="appUpdMascot" src="/brand/mascot/update.webp" width="134" height="150" alt="" aria-hidden="true" />
        {live ? (
          <>
            <h2 id="appUpdTitle">یه فرفروی تازه‌تر اومده!</h2>
            <p>{ask.reason || "به‌روزش کن؛ یه دقیقه طول می‌کشه و بعدش برمی‌گردی همین‌جا."}</p>
            <button type="button" className="appUpdMain" onClick={() => { openStorePage(); close(); }}>به‌روزرسانی از کافه‌بازار</button>
            <button type="button" className="appUpdLater" onClick={close}>بعداً</button>
          </>
        ) : (
          <>
            <h2 id="appUpdTitle">این توی نسخهٔ بعدی اپ میاد</h2>
            <p>نسخهٔ تازهٔ فرفرو چند روز دیگه روی کافه‌بازار میاد. تا اون موقع {SITE} رو توی کروم باز کن؛ اون‌جا همین الان کار می‌کنه.</p>
            <button type="button" className="appUpdMain" onClick={copySite}>{copied ? "آدرس کپی شد" : `کپی آدرس ${SITE}`}</button>
            <button type="button" className="appUpdLater" onClick={close}>باشه</button>
          </>
        )}
      </div>
    </div>
  ), document.body);
}
