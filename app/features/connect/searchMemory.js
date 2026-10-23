// «سالن و آرتیست من» forgets its search when a salon page opens over it (the page is swapped, not stacked).
// This keeps the typed text, the results and the scroll position for a while, so Back lands exactly where the
// client left. In memory only (a reload starts fresh), tied to the person's name, dropped after 15 minutes.
const TTL_MS = 15 * 60 * 1000;
let memory = null;

export function rememberSearch(owner, patch, now = Date.now()) {
  const same = memory && memory.owner === owner;
  memory = { ...(same ? memory : { query: "", search: null, scrollY: 0 }), ...patch, owner, at: now };
}

export function recallSearch(owner, now = Date.now()) {
  if (!memory || memory.owner !== owner || now - memory.at > TTL_MS) return null;
  return memory;
}

export function forgetSearch() {
  memory = null;
}
