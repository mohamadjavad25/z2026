import { subscribeToPushNotifications } from "../homeAppHelpers";
import { BellRing } from "lucide-react";

import { useHome } from "../HomeContext";
export function PushSoftAsk() {
  const {
    pushSoftAskVisible,
    setPushSoftAskVisible
  } = useHome();

  return (
    (pushSoftAskVisible && (
          <div className="pushSoftAsk" role="status" aria-live="polite">
            <BellRing size={17} />
            <div>
              <b>اعلان‌ها رو روشن کن</b>
              <small>تا حتی وقتی اپ بسته‌ست بفهمی نوبتت تأیید شد یا نه.</small>
            </div>
            <div className="pushSoftAskActions">
              <button
                type="button"
                onClick={() => {
                  setPushSoftAskVisible(false);
                  void subscribeToPushNotifications();
                }}
              >
                روشنش کن
              </button>
              <button
                type="button"
                onClick={() => {
                  setPushSoftAskVisible(false);
                  window.localStorage.setItem("frfro_push_soft_ask_dismissed", "1");
                }}
              >
                بعداً
              </button>
            </div>
          </div>
        )) || null
  );
}
