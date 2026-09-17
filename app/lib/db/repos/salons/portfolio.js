import { getDb } from "../../connection.js";
import * as postsRepo from "../posts.js";
export function listSalonPortfolio(salonUserId) {
  const fromPosts = postsRepo.listPostsByOwner(salonUserId).map((post) => ({
    id: post.id,
    salon_user_id: post.ownerUserId,
    title: post.title || "",
    tag: post.tag || "",
    tile: "tile4",
    image: post.image || "",
    caption: post.caption || "",
    inExplore: post.inExplore !== false,
    featured: Boolean(post.featured),
    created_at: post.createdAt
  }));

  const legacy = getDb()
    .prepare("SELECT * FROM salon_portfolio WHERE salon_user_id = ? ORDER BY id DESC")
    .all(salonUserId)
    .map((row) => ({
      ...row,
      caption: "",
      inExplore: false,
      featured: false,
      legacy: true
    }));

  if (!legacy.length) return fromPosts;
  const keys = new Set(fromPosts.map((item) => `${item.title}::${item.image}`));
  return [...fromPosts, ...legacy.filter((row) => !keys.has(`${row.title}::${row.image}`))];
}

function syncSalonPostCount(salonUserId) {
  const count = Number(
    getDb().prepare("SELECT COUNT(*) AS c FROM posts WHERE owner_user_id = ?").get(salonUserId)?.c || 0
  );
  getDb().prepare("UPDATE salons SET post_count = ? WHERE user_id = ?").run(count, salonUserId);
}

export function addSalonPortfolio(salonUserId, data) {
  const post = postsRepo.createPost(salonUserId, {
    title: data.title || "",
    tag: data.tag || "",
    image: data.image || "",
    caption: data.caption || "",
    inExplore: data.inExplore !== false,
    featured: Boolean(data.featured)
  });
  syncSalonPostCount(salonUserId);
  return {
    id: post.id,
    salon_user_id: salonUserId,
    title: post.title || "",
    tag: post.tag || "",
    tile: data.tile || "tile4",
    image: post.image || "",
    caption: post.caption || "",
    inExplore: post.inExplore !== false,
    featured: Boolean(post.featured),
    created_at: post.createdAt
  };
}

export function updateSalonPortfolio(id, salonUserId, data) {
  const updated = postsRepo.updatePost(id, salonUserId, {
    title: data.title,
    tag: data.tag,
    image: data.image,
    caption: data.caption,
    inExplore: data.inExplore,
    featured: data.featured
  });
  if (updated) {
    syncSalonPostCount(salonUserId);
    return {
      id: updated.id,
      salon_user_id: salonUserId,
      title: updated.title || "",
      tag: updated.tag || "",
      tile: data.tile || "tile4",
      image: updated.image || "",
      caption: updated.caption || "",
      inExplore: updated.inExplore !== false,
      featured: Boolean(updated.featured),
      created_at: updated.createdAt
    };
  }

  const current = getDb().prepare("SELECT * FROM salon_portfolio WHERE id = ? AND salon_user_id = ?").get(id, salonUserId);
  if (!current) return null;

  const post = postsRepo.createPost(salonUserId, {
    title: data.title ?? current.title,
    tag: data.tag ?? current.tag,
    image: data.image ?? current.image,
    caption: data.caption || "",
    inExplore: data.inExplore !== false,
    featured: Boolean(data.featured)
  });
  getDb().prepare("DELETE FROM salon_portfolio WHERE id = ? AND salon_user_id = ?").run(id, salonUserId);
  syncSalonPostCount(salonUserId);
  return {
    id: post.id,
    salon_user_id: salonUserId,
    title: post.title || "",
    tag: post.tag || "",
    tile: data.tile || current.tile || "tile4",
    image: post.image || "",
    caption: post.caption || "",
    inExplore: post.inExplore !== false,
    featured: Boolean(post.featured),
    created_at: post.createdAt
  };
}

export function deleteSalonPortfolio(id, salonUserId) {
  if (postsRepo.deletePost(id, salonUserId)) {
    syncSalonPostCount(salonUserId);
    return true;
  }
  return getDb().prepare("DELETE FROM salon_portfolio WHERE id = ? AND salon_user_id = ?").run(id, salonUserId).changes > 0;
}
