/**
 * «همین نوبت را جای دیگر بگیر»: the expired card on the client's home asks the shell to open another place's booking
 * form with the same services, day and time filled in. A tiny window event keeps the card from having to be wired
 * through every layer of the home screen (same idea as features/exit/exitDialogBus.js).
 */
const EVENT = "frfro:book-elsewhere";

/** `place`: { id, name, area, avatar }; `prefill`: { names: string[], day, time, people? }. */
export function requestBookElsewhere(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export function onBookElsewhere(handler) {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
