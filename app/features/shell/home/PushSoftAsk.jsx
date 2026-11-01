import { subscribeToPushNotifications } from "../homeAppHelpers";
import { BellRing, CalendarCheck, Clock3, Sparkles } from "lucide-react";

import { useHome } from "../HomeContext";

/**
 * Asks to turn on notifications before the browser's own prompt (a cold prompt gets a reflexive «Block»).
 * Owner's redesign 2026-11-01: it must read as important, so it is a card over a dimmed screen with a big bell, what
 * the person gets (three short chips), one pink «روشنش کن» and a quiet «بعداً», which stops asking on this device.
 */
export function PushSoftAsk() {
  const {
    pushSoftAskVisible,
    setPushSoftAskVisible
  } = useHome();

  if (!pushSoftAskVisible) return null;
  return (
    <div className="pushSoftAskBack">
      <div className="pushSoftAsk" role="dialog" aria-modal="true" aria-labelledby="pushSoftAskTitle">
        <span className="pushSoftAskBell" aria-hidden="true"><BellRing size={30} /></span>
        <h3 id="pushSoftAskTitle">اعلان‌ها رو روشن کن</h3>
        <p>خبر نوبت‌هات همون لحظه بهت می‌رسه، حتی وقتی اپ بسته‌ست.</p>
        <ul className="pushSoftAskGains">
          <li><Sparkles size={15} aria-hidden="true" />درخواست تازه</li>
          <li><CalendarCheck size={15} aria-hidden="true" />تأیید نوبت</li>
          <li><Clock3 size={15} aria-hidden="true" />یادآوری</li>
        </ul>
        <button
          type="button"
          className="pushSoftAskYes"
          onClick={() => {
            setPushSoftAskVisible(false);
            void subscribeToPushNotifications();
          }}
        >
          <BellRing size={18} aria-hidden="true" />
          روشنش کن
        </button>
        <button
          type="button"
          className="pushSoftAskLater"
          onClick={() => {
            setPushSoftAskVisible(false);
            try {
              window.localStorage.setItem("frfro_push_soft_ask_dismissed", "1");
            } catch {
              // Private mode: it may ask again next visit.
            }
          }}
        >
          بعداً
        </button>
      </div>
    </div>
  );
}
