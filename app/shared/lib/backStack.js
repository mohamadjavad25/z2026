/**
 * The phone's back button for a single-page app.
 *
 * The home screen is one URL: tabs, profile views, salon/artist pages and every
 * sheet are React state, so the browser had no history to go back to and the
 * back button closed the whole app. Anything that "back" should close registers
 * a handler here while it is open (see useBackHandler). While at least one is
 * registered we keep one extra history entry on top; pressing back pops it, and
 * instead of leaving we run the top handler and put the entry back if something
 * is still open. When nothing is open the entry is removed, so back leaves the
 * app as usual.
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
let hasEntry = false;
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
// render (e.g. post → its artist's page) don't pop and re-push the entry.
function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  window.setTimeout(() => {
    syncQueued = false;
    if (entries.length && !hasEntry) {
      window.history.pushState({ ...(window.history.state || {}), frfroBack: true }, "");
      hasEntry = true;
    } else if (!entries.length && hasEntry) {
      // Closed with its own button: drop the extra entry so the next back leaves.
      hasEntry = false;
      ignoredPops += 1;
      window.history.back();
    }
  }, 0);
}

function handlePopState() {
  if (ignoredPops > 0) {
    ignoredPops -= 1;
    return;
  }
  if (!hasEntry) return;
  hasEntry = false;
  const entry = topEntry();
  if (entry) {
    // A handler returns false when it can't close right now (e.g. while saving).
    if (entry.handler() !== false) removeEntry(entry.id);
  }
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
