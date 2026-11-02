import { apiFetch } from "./client";

/** Fired with the client's new «خبرم کن» list after a join, so their home shows it at once. */
export const WAITLIST_EVENT = "frfro-waitlist";

/** POST /api/waitlist { kind, ownerId, day, services: [{ name, minutes }] } → { entry, freeNow, entries } */
export async function joinWaitlist({ kind, ownerId, day, services }) {
  const result = await apiFetch("/api/waitlist", { method: "POST", body: JSON.stringify({ kind, ownerId, day, services }) });
  const entries = result.payload?.data?.entries;
  if (result.ok && Array.isArray(entries) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WAITLIST_EVENT, { detail: entries }));
  }
  return result;
}
