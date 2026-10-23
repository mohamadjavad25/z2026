/** One global support center (SupportHost): anything can ask for it with openSupport(). */
const OPEN_EVENT = "frfro:open-support";
const READ_EVENT = "frfro:support-read";

/** Opens the support center. { ticketId } jumps straight into that conversation; { view: "new" } opens the new-message form. */
export function openSupport(detail = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
}

export const onOpenSupport = (handler) => {
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
};

/** Ask SupportHost to refresh the unread count (after reading or sending). */
export const notifySupportRead = () => typeof window !== "undefined" && window.dispatchEvent(new Event(READ_EVENT));
export const onSupportRead = (handler) => {
  window.addEventListener(READ_EVENT, handler);
  return () => window.removeEventListener(READ_EVENT, handler);
};

/** The unread count SupportHost last fetched, for the buttons that show it (SupportButton). */
const UNREAD_EVENT = "frfro:support-unread";
export let supportUnread = 0;
export function publishSupportUnread(count) {
  supportUnread = count;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: count }));
}
export const onSupportUnread = (handler) => {
  const listener = (event) => handler(Number(event.detail) || 0);
  window.addEventListener(UNREAD_EVENT, listener);
  return () => window.removeEventListener(UNREAD_EVENT, listener);
};
