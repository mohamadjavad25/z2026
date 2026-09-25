import { apiFetch, apiJson } from "./client";

/** GET /api/explore/posts → { data: { posts, savedTitles } } */
export async function getExplorePosts(tag) {
  const query = tag && tag !== "همه" ? `?tag=${encodeURIComponent(tag)}` : "";
  return apiJson(`/api/explore/posts${query}`);
}

/** GET /api/posts → { data: { posts } } (owner session; artist/salon portfolio) */
export async function getPosts() {
  return apiJson("/api/posts");
}

/** POST /api/posts → { data: { post } } status 201 */
export async function createPost(body) {
  return apiFetch("/api/posts", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** PATCH /api/posts/:id → { data: { post } } (not PUT) */
export async function updatePost(id, body) {
  return apiFetch(`/api/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/** DELETE /api/posts/:id → { data: { ok: true } } */
export async function deletePost(id) {
  return apiFetch(`/api/posts/${id}`, {
    method: "DELETE"
  });
}

/** POST /api/posts/:id/save → { data: { saved: boolean } } */
export async function savePost(id) {
  return apiFetch(`/api/posts/${id}/save`, {
    method: "POST"
  });
}

/** POST /api/posts/:id/view → { data: { post } } */
export async function viewPost(id) {
  return apiFetch(`/api/posts/${id}/view`, {
    method: "POST"
  });
}
