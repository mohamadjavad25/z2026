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
              <b>اعلان‌ها را فعال کن</b>
              <small>تا از تایید، رد یا انقضای رزروهایت حتی وقتی اپ باز نیست باخبر شوی.</small>
            </div>
            <div className="pushSoftAskActions">
              <button
                type="button"
                onClick={() => {
                  setPushSoftAskVisible(false);
                  void subscribeToPushNotifications();
                }}
              >
                فعال کن
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
