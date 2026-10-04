/**
 * Tracks in-flight write requests (anything that is not a GET) so the UI can show
 * one global "working" indicator for every mutation, instead of each button having
 * to implement its own. Reads are excluded on purpose: background polling would
 * keep the indicator on forever.
 */
let pending = 0;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(pending);
}

export function trackRequest(promise, method = "GET") {
  if (String(method).toUpperCase() === "GET") return promise;
  pending += 1;
  emit();
  const done = () => {
    pending = Math.max(0, pending - 1);
    emit();
  };
  promise.then(done, done);
  return promise;
}

export function subscribeBusy(listener) {
  listeners.add(listener);
  listener(pending);
  return () => listeners.delete(listener);
}
