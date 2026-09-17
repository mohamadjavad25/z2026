/**
 * Lightweight busy/in-flight guards used to stop a user action (charge
 * wallet, create a booking, approve a request, ...) from firing twice when
 * clicked rapidly or from two tabs. Each of the app's hooks inlines this
 * exact pattern locally (a ref for the synchronous check + state for the UI
 * disabled attribute); these two factories are the reference implementation
 * that scripts/seed-ux-busy-test.mjs and scripts/seed-ux-phase4-test.mjs
 * import directly to verify that pattern's semantics in isolation. Nothing
 * under app/ imports this file — that is expected, not dead code.
 */

export function createBusyGate() {
  let busy = false;
  return {
    isBusy: () => busy,
    async run(fn) {
      if (busy) return { skipped: true };
      busy = true;
      try {
        const value = await fn();
        return { ok: true, value };
      } finally {
        busy = false;
      }
    }
  };
}

export function createBusyIdGate() {
  let busyId = "";
  return {
    getBusyId: () => busyId,
    async run(id, fn) {
      if (busyId) return { skipped: true };
      busyId = id;
      try {
        const value = await fn();
        return { ok: true, value };
      } finally {
        busyId = "";
      }
    }
  };
}
