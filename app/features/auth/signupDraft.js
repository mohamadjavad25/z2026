// The phone and name typed into the sign-up steps, kept for 10 minutes in this tab only (sessionStorage),
// so the browser's Back/Forward does not empty the form. The password and the code are never stored.
// Every access is wrapped: private windows and blocked storage just mean "nothing remembered".
const KEY = "frfro_signup_draft";
export const SIGNUP_DRAFT_TTL_MS = 10 * 60 * 1000;

export function readSignupDraft(now = Date.now()) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(KEY) || "null");
    if (saved && now - Number(saved.at) < SIGNUP_DRAFT_TTL_MS) return { phone: String(saved.phone || ""), name: String(saved.name || "") };
  } catch {
    // no storage or a damaged value: start empty
  }
  return { phone: "", name: "" };
}

export function saveSignupDraft({ phone, name }, now = Date.now()) {
  try {
    if (!phone && !name) { window.sessionStorage.removeItem(KEY); return; }
    window.sessionStorage.setItem(KEY, JSON.stringify({ phone, name, at: now }));
  } catch {
    // nothing to do
  }
}

export function clearSignupDraft() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
