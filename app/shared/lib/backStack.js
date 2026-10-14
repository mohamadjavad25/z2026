/**
 * The phone's back button for a single-page app.
 *
 * The home screen is one URL: tabs, profile views, salon/artist pages and every
 * sheet are React state, so the browser had no history to go back to and the
 * back button closed the whole app. Anything that "back" should close registers
 * a handler here while it is open (see useBackHandler), and gets one history
 * entry of its own. Pressing back pops that entry and runs the top handler
 * instead of leaving; closing it any other way (its X, the backdrop) removes
 * the entry again. When nothing is open, back leaves the app as usual.
 *
 * Entries are only ever added when something opens, i.e. right after the
 * user's tap — never after a back press. Chrome on Android skips the page that
 * added an entry without a fresh tap (its "history manipulation intervention"),
 * so re-adding one after each back press made the second press leave the site.
 *
 * Priority: overlays (sheets) close before the page under them, and pages before
 * the tab. Same priority: the most recently opened wins.
 */

export const BACK_PRIORITY = {
  tab: 1,
  view: 2,
  page: 4,
  overlay: 10
};

const entries = [];
let nextId = 1;
// History entries added by this module that are still there.
let pushed = 0;
let ignoredPops = 0;
let syncQueued = false;
let listening = false;

function topEntry() {
  let top = null;
  for (const entry of entries) {
    if (!top || entry.priority > top.priority || (entry.priority === top.priority && entry.id > top.id)) top = entry;
  }
  return top;
}

function removeEntry(id) {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index !== -1) entries.splice(index, 1);
}

// Deferred to the next task so a sheet closing and another opening in the same
// render (e.g. post → its artist's page) leave history untouched.
function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  window.setTimeout(() => {
    syncQueued = false;
    const diff = entries.length - pushed;
    if (diff > 0) {
      for (let i = 0; i < diff; i += 1) {
        window.history.pushState({ ...(window.history.state || {}), frfroBack: true }, "");
      }
      pushed += diff;
    } else if (diff < 0) {
      // Closed with its own button: drop its entries so back doesn't land on them.
      pushed += diff;
      ignoredPops += 1;
      window.history.go(diff);
    }
  }, 0);
}

function handlePopState() {
  if (ignoredPops > 0) {
    ignoredPops -= 1;
    return;
  }
  if (pushed === 0) return;
  pushed -= 1;
  const entry = topEntry();
  // A handler returns false when it can't close right now (e.g. while saving);
  // it keeps its place and gets its entry back.
  if (entry && entry.handler() !== false) removeEntry(entry.id);
  queueSync();
}

/** Registers `handler` for the back button; returns the unregister function. */
export function registerBackHandler(handler, priority = BACK_PRIORITY.overlay) {
  if (typeof window === "undefined") return () => {};
  if (!listening) {
    window.addEventListener("popstate", handlePopState);
    listening = true;
  }
  const id = nextId++;
  entries.push({ id, priority, handler });
  queueSync();
  return () => {
    removeEntry(id);
    queueSync();
  };
}

/** True while a sheet or other overlay is open (used by pull-to-refresh to stay out of the way). */
export function hasOpenOverlay() {
  return entries.some((entry) => entry.priority >= BACK_PRIORITY.overlay);
}
