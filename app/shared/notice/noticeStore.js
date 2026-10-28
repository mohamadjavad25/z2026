/**
 * One store for every notice that shows at the top of the screen (see NoticeHost.jsx).
 * Anything can call `notify(...)`, from a hook, a sheet or the admin panel, without
 * prop drilling. The store only holds state; the look lives in NoticeHost + notice.css.
 *
 * Input is a plain string (the old `setAppToast("...")` call shape, tone inferred from
 * the words) or an object:
 *   { kind, tone, title, text, big, label, avatar, p, action: { label, onClick }, timer, id, onClose, steps }
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
 *
 * A notice at the top is for short news («لینک کپی شد»). A longer one turns into a full-width card by itself
 * (NoticeHost, LONG_NOTICE_CHARS). Instructions in several steps never go on top: pass
 * `steps: { title, items: [...], doneLabel? }` with a short `title`, and the short title shows on top while the
 * steps open in a small sheet at the bottom that stays until «باشه» (user's decision 2026-10-28).
 */

/** Same word lists the sound hook used before the notices existed, so sounds keep matching; the rest are the
 *  everyday words of docs/COPY.md («نرفت»، «نیومد»، «دوباره بزن»…). */
export const ERROR_WORDS = /(نشد|خطا|مشکل|نامعتبر|اشغال|قطع|نرفت|نیومد|نرسید|ننشست|دسترسی نداریم|دوباره بزن|درست نیست)/;
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
/** One steps sheet at a time; a new one replaces the old. */
const STEPS_ID = "notice-steps";

/**
 * A notice that leaves by itself stays at least long enough to be read: about 14 letters a second plus two seconds
 * to notice it, up to 15 seconds. A long message used to vanish before its end was read.
 */
const READ_MS_PER_CHAR = 70;
const READ_MS_MAX = 15000;
export function readingTime(base, timer) {
  if (!timer) return timer;
  const length = `${base.title || ""} ${base.text || ""} ${base.big || ""}`.trim().length;
  return Math.max(timer, Math.min(READ_MS_MAX, 2000 + length * READ_MS_PER_CHAR));
}

let items = [];
let sequence = 0;
const listeners = new Set();
const noticeListeners = new Set();

export function inferTone(text = "") {
  if (ERROR_WORDS.test(text)) return "error";
  if (DONE_WORDS.test(text)) return "success";
  return "info";
}

/**
 * At most MAX_VISIBLE at once. Short-lived notices make room first, so a quick "saved" never pushes out a notice
 * that waits to be closed (the appointment alarm, an error, the operator's notice); only when every one of them
 * stays does the oldest go.
 */
function keepVisible(list) {
  const sheets = list.filter((item) => item.kind === "steps");
  const next = list.filter((item) => item.kind !== "steps");
  while (next.length > MAX_VISIBLE) {
    const passing = next.findIndex((item) => item.timer > 0);
    next.splice(passing >= 0 ? passing : 0, 1);
  }
  return [...next, ...sheets];
}

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Shows a notice. Returns its id. A notice with an `id` that is already showing replaces it,
 * so the same message is never stacked twice.
 */
export function notify(input) {
  const { steps, ...base } = typeof input === "string" ? { title: input } : { ...(input || {}) };
  if (steps?.items?.length) {
    const sheet = { kind: "steps", tone: "info", id: STEPS_ID, timer: 0, ...steps };
    items = [...items.filter((item) => item.id !== STEPS_ID), sheet];
  }
  const tone = base.tone || inferTone(base.title || base.text || "");
  const kind = base.kind || (tone === "error" ? "err" : "island");
  const notice = {
    ...base,
    tone,
    kind,
    id: base.id || `notice-${++sequence}`,
    timer: base.timer ?? readingTime(base, DEFAULT_TIMER[kind] ?? 0)
  };
  items = keepVisible([...items.filter((item) => item.id !== notice.id), notice]);
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
