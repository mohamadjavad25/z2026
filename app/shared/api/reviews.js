import { apiFetch, apiJson } from "./client";

/** GET /api/reviews?targetUserId= → { data: { reviews } } */
export async function getReviews(targetUserId) {
  return apiJson(`/api/reviews?targetUserId=${encodeURIComponent(targetUserId)}`);
}

/** POST /api/reviews → { data: { review, ...summary } } */
export async function createReview(body) {
  return apiFetch("/api/reviews", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** PATCH /api/reviews/:id → { data: { review } } */
export async function replyToReview(reviewId, replyText) {
  return apiFetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: JSON.stringify({ replyText })
  });
}

/** POST /api/reviews/:id/like → { data: { liked, likeCount } } */
export async function toggleReviewLike(reviewId) {
  return apiFetch(`/api/reviews/${encodeURIComponent(reviewId)}/like`, {
    method: "POST"
  });
}
