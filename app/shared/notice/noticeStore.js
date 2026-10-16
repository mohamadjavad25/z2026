/**
 * One store for every notice that shows at the top of the screen (see NoticeHost.jsx).
 * Anything can call `notify(...)`, from a hook, a sheet or the admin panel, without
 * prop drilling. The store only holds state; the look lives in NoticeHost + notice.css.
 *
 * Input is a plain string (the old `setAppToast("...")` call shape, tone inferred from
 * the words) or an object:
 *   { kind, tone, title, text, big, label, avatar, p, action: { label, onClick }, timer, id, onClose }
 *
 * Kinds (pick by what the notice is, not by how important it sounds):
 *   island  a live pill, auto-hides. Quick confirmation. Default for success and info.
 *   pill    a tiny check, auto-hides fast. "کپی شد" style.
 *   ticket  a booking slip with a big time. Auto-hides after a while unless timer is 0.
 *   glass   a message from a person (salon, artist, client). Auto-hides after a while.
 *   ring    a countdown reminder with a ring. Stays until closed.
 *   ban     a promotion with a big number. Stays until closed.
 *   err     an error with a short shake. Stays until closed. Default for error tone.
 *   note    the operator's app-wide notice (SiteNotice). Stays until closed.
 */

/** Same word lists the sound hook used before the notices existed, so sounds keep matching. */
export const ERROR_WORDS = /(نشد|خطا|مشکل|نامعتبر|اشغال|قطع)/;
export const DONE_WORDS = /شد/;

const DEFAULT_TIMER = {
  island: 3200,
  pill: 1600,
  ticket: 9000,
  glass: 7000,
  ring: 0,
  ban: 0,
  err: 0,
  note: 0
};

const MAX_VISIBLE = 3;

let items = [];
let sequence = 0;
const listeners = new Set();
const noticeListeners = new Set();

export function inferTone(text = "") {
  if (ERROR_WORDS.test(text)) return "error";
  if (DONE_WORDS.test(text)) return "success";
  return "info";
}

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Shows a notice. Returns its id. A notice with an `id` that is already showing replaces it,
 * so the same message is never stacked twice.
 */
export function notify(input) {
  const base = typeof input === "string" ? { title: input } : { ...(input || {}) };
  const tone = base.tone || inferTone(base.title || base.text || "");
  const kind = base.kind || (tone === "error" ? "err" : "island");
  const notice = {
    ...base,
    tone,
    kind,
    id: base.id || `notice-${++sequence}`,
    timer: base.timer ?? DEFAULT_TIMER[kind] ?? 0
  };
  const rest = items.filter((item) => item.id !== notice.id);
  items = [...rest, notice].slice(-MAX_VISIBLE);
  emit();
  for (const listener of noticeListeners) listener(notice);
  return notice.id;
}

/** Removes a notice (the host calls this after its leaving animation) and runs its onClose once. */
export function dismissNotice(id) {
  const found = items.find((item) => item.id === id);
  if (!found) return;
  items = items.filter((item) => item.id !== id);
  emit();
  try {
    found.onClose?.();
  } catch {
    // a close handler must never block the notice from leaving
  }
}

/** Every notice as it is shown, oldest first. Stable between changes, for useSyncExternalStore. */
export function getNotices() {
  return items;
}

export function subscribeNotices(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Calls `listener` with each new notice as it is shown (sound and analytics hooks use this). */
export function onNotify(listener) {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
}
