/** One global support center (opened by the floating button): anything can ask for it with openSupport(). */
const OPEN_EVENT = "farfaroo:open-support";
const READ_EVENT = "farfaroo:support-read";

/** Opens the support center. { ticketId } jumps straight into that conversation; { view: "new" } opens the new-message form. */
export function openSupport(detail = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
}

export const onOpenSupport = (handler) => {
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
};

/** Tell the floating button to refresh its unread count (after reading or sending). */
export const notifySupportRead = () => typeof window !== "undefined" && window.dispatchEvent(new Event(READ_EVENT));
export const onSupportRead = (handler) => {
  window.addEventListener(READ_EVENT, handler);
  return () => window.removeEventListener(READ_EVENT, handler);
};
