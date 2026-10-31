import { apiJson } from "./client";

/** Terms of one team pair (owner's decision 2026-10-28). The salon names the artist (`artistUserId`), the artist the salon (`salonUserId`). */
const pairQuery = (pair) => new URLSearchParams(Object.fromEntries(Object.entries(pair).map(([key, value]) => [key, String(value)])));

/** GET /api/team-terms → { side, current, upcoming, pending } */
export const getTeamTerms = (pair) => apiJson(`/api/team-terms?${pairQuery(pair)}`);
/** POST /api/team-terms { …pair, days, from, to, share, ownShare?, note?, effectiveFrom? } → a proposal; same shape as GET */
export const proposeTeamTerms = (pair, terms) => apiJson("/api/team-terms", { method: "POST", body: JSON.stringify({ ...pair, ...terms }) });
/** PATCH /api/team-terms { …pair, id, action: "accept" | "reject" | "cancel" } → same shape as GET */
export const answerTeamTerms = (pair, id, action) => apiJson("/api/team-terms", { method: "PATCH", body: JSON.stringify({ ...pair, id, action }) });

/** GET /api/team-ledger → { side, totals, lines, waiting, closed, terms } */
export const getTeamLedger = (pair) => apiJson(`/api/team-ledger?${pairQuery(pair)}`);
/** PATCH /api/team-ledger { …pair, line, amount } (the salon) → same shape as GET */
export const setTeamLineAmount = (pair, line, amount) => apiJson("/api/team-ledger", { method: "PATCH", body: JSON.stringify({ ...pair, line, amount }) });
/** POST /api/team-ledger { …pair, action: "start", paid } | { action: "confirm" | "dispute" | "cancel", id, amount? } */
export const sendTeamSettlement = (pair, body) => apiJson("/api/team-ledger", { method: "POST", body: JSON.stringify({ ...pair, ...body }) });

/** GET /api/artist/leaves → { leaves } */
export const getLeaves = () => apiJson("/api/artist/leaves");
/** POST /api/artist/leaves { from, to, start, end, note } → 201 { leave, leaves } or 409 { code: "HAS_BOOKINGS", plan } */
export const addLeave = (body) => apiJson("/api/artist/leaves", { method: "POST", body: JSON.stringify(body) });
/** DELETE /api/artist/leaves { id } → { leaves } */
export const removeLeave = (id) => apiJson("/api/artist/leaves", { method: "DELETE", body: JSON.stringify({ id }) });
