import { apiFetch, apiJson } from "./client";

/** GET /api/contact-requests → { requests } (the client's requests to salons and artists not on frfro yet) */
export async function listContactRequests() {
  return apiJson("/api/contact-requests");
}

/** POST /api/contact-requests → 201 { request, sms } | 200 { found } */
export async function sendContactRequest(body) {
  return apiFetch("/api/contact-requests", { method: "POST", body: JSON.stringify(body) });
}

/** DELETE /api/contact-requests { id } → take back a waiting request, or hide a closed one */
export async function removeContactRequest(id) {
  return apiFetch("/api/contact-requests", { method: "DELETE", body: JSON.stringify({ id }) });
}

/** POST /api/contact-requests/claim { code } (salon/artist from the SMS link) → { count } */
export async function claimContactRequests(code) {
  return apiFetch("/api/contact-requests/claim", { method: "POST", body: JSON.stringify({ code }) });
}

/** POST /api/contact-requests/opt-out { code } («دیگه پیام نده» on the link page) */
export async function optOutOfContactRequests(code) {
  return apiFetch("/api/contact-requests/opt-out", { method: "POST", body: JSON.stringify({ code }) });
}
