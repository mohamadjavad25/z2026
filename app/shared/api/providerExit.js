import { apiFetch } from "./client";

/** GET /api/provider-exit?scope=account | team&salonUserId=… | staff&staffId=… → { data: { plan } } */
export async function getExitPlan(scope, params = {}) {
  const query = new URLSearchParams({ scope });
  if (params.salonUserId) query.set("salonUserId", String(params.salonUserId));
  if (params.staffId) query.set("staffId", String(params.staffId));
  return apiFetch(`/api/provider-exit?${query}`);
}

/** POST /api/provider-exit { scope, …, kind, id } → «لغو با اطلاع مشتری» for one booking → { data: { plan } } */
export async function cancelExitBooking(scope, params, item) {
  return apiFetch("/api/provider-exit", {
    method: "POST",
    body: JSON.stringify({ scope, ...params, kind: item.kind, id: item.id })
  });
}

/** POST /api/booking-proposals { kind: "salon", id, toStaff, … } → the client is asked to accept another artist. */
export async function proposeHandover(body) {
  return apiFetch("/api/booking-proposals", { method: "POST", body: JSON.stringify({ kind: "salon", ...body }) });
}

/** DELETE /api/booking-proposals { kind, id } → the provider takes a proposal back. */
export async function withdrawProposal(body) {
  return apiFetch("/api/booking-proposals", { method: "DELETE", body: JSON.stringify(body) });
}

/** POST /api/booking-proposals/answer { kind, id, action: "accept" | "cancel" } (the client) */
export async function answerProposal(body) {
  return apiFetch("/api/booking-proposals/answer", { method: "POST", body: JSON.stringify(body) });
}
