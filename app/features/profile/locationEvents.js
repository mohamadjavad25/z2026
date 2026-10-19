/** «شهر ثبت نشده» under the name asks Settings to open «ثبت لوکیشن» (ProfileLocationSettings listens). */
const OPEN_EVENT = "frfro:open-location";

export function openLocationSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

export const onOpenLocationSettings = (handler) => {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
};
