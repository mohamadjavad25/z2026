import { apiJson } from "./client";

/*
 * «شرایط همکاری سالن» (owner's design 2026-10-28). The salon's own endpoints (first two) are the UI's ASSUMPTION of what
 * the server agent builds; adjust the paths/shapes here only. Terms: { days, from, to, share, ownShare, allowProposals, version }.
 */

/** GET /api/salon-join-terms (salon) → { terms: Terms | null } (null until the salon saved them once) */
export const getSalonJoinTerms = () => apiJson("/api/salon-join-terms");
/** PUT /api/salon-join-terms (salon) { days, from, to, share, ownShare, allowProposals } → { terms } */
export const saveSalonJoinTerms = (terms) => apiJson("/api/salon-join-terms", { method: "PUT", body: JSON.stringify(terms) });

/** POST /api/artist/join-salon { salonUserId, code, termsVersion } → 201, or 409 { code: "TERMS_CHANGED", terms } */
export const joinSalonWithTerms = (body) => apiJson("/api/artist/join-salon", { method: "POST", body: JSON.stringify(body) });
/** POST /api/artist/join-proposal { salonUserId, code, termsVersion, days, from, to, share, ownShare, note } → 201 */
export const sendJoinProposal = (body) => apiJson("/api/artist/join-proposal", { method: "POST", body: JSON.stringify(body) });

/** PATCH /api/salon-collabs { id, action: "accept" | "reject" } | { id, action: "counter", terms } → { collabs, staff? } */
export const answerSalonCollab = (body) => apiJson("/api/salon-collabs", { method: "PATCH", body: JSON.stringify(body) });
