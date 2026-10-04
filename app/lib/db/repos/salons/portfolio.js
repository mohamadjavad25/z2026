import { getDb } from "../../connection.js";
import * as postsRepo from "../posts.js";

// A salon's portfolio is simply its posts (migration 013 folded the old
// salon_portfolio table in); these are thin wrappers that keep the salon API's shape.

function toItem(post, salonUserId) {
  return {
    id: post.id,
    salon_user_id: salonUserId,
    title: post.title || "",
    tag: post.tag || "",
    image: post.image || "",
    caption: post.caption || "",
    inExplore: post.inExplore !== false,
    featured: Boolean(post.featured),
    saves: post.saves,
    views: post.views,
    created_at: post.createdAt,
    createdAt: post.createdAt
  };
}

export async function listSalonPortfolio(salonUserId, runner = null, { publicOnly = false } = {}) {
  const db = runner || (await getDb());
  const rows = await postsRepo.listPostsByOwner(salonUserId, db, { publicOnly });
  return rows.map((post) => toItem(post, salonUserId));
}

export async function addSalonPortfolio(salonUserId, data, options = {}) {
  const db = await getDb();
  const post = await postsRepo.createPost(salonUserId, data, db, options);
  return toItem(post, salonUserId);
}

export async function updateSalonPortfolio(id, salonUserId, data, options = {}) {
  const db = await getDb();
  const updated = await postsRepo.updatePost(id, salonUserId, data, db, options);
  return updated ? toItem(updated, salonUserId) : null;
}

export async function deleteSalonPortfolio(id, salonUserId) {
  const db = await getDb();
  return postsRepo.deletePost(id, salonUserId, db);
}
