import { getDb, all, get, run } from "../../connection.js";
import * as postsRepo from "../posts.js";

export async function listSalonPortfolio(salonUserId, runner = null) {
  const db = runner || (await getDb());
  const postRows = await postsRepo.listPostsByOwner(salonUserId, db);
  const fromPosts = postRows.map((post) => ({
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

  const legacyRows = await all(db, "SELECT * FROM salon_portfolio WHERE salon_user_id = $1 ORDER BY id DESC", [salonUserId]);
  const legacy = legacyRows.map((row) => ({
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

async function syncSalonPostCount(salonUserId, runner = null) {
  const db = runner || (await getDb());
  const countRow = await get(db, "SELECT COUNT(*) AS c FROM posts WHERE owner_user_id = $1", [salonUserId]);
  const count = Number(countRow?.c || 0);
  await run(db, "UPDATE salons SET post_count = $1 WHERE user_id = $2", [count, salonUserId]);
}

export async function addSalonPortfolio(salonUserId, data) {
  const db = await getDb();
  const post = await postsRepo.createPost(salonUserId, {
    title: data.title || "",
    tag: data.tag || "",
    image: data.image || "",
    caption: data.caption || "",
    inExplore: data.inExplore !== false,
    featured: Boolean(data.featured)
  }, db);
  await syncSalonPostCount(salonUserId, db);
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

export async function updateSalonPortfolio(id, salonUserId, data) {
  const db = await getDb();
  const updated = await postsRepo.updatePost(id, salonUserId, {
    title: data.title,
    tag: data.tag,
    image: data.image,
    caption: data.caption,
    inExplore: data.inExplore,
    featured: data.featured
  }, db);
  if (updated) {
    await syncSalonPostCount(salonUserId, db);
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

  const current = await get(db, "SELECT * FROM salon_portfolio WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  if (!current) return null;

  const post = await postsRepo.createPost(salonUserId, {
    title: data.title ?? current.title,
    tag: data.tag ?? current.tag,
    image: data.image ?? current.image,
    caption: data.caption || "",
    inExplore: data.inExplore !== false,
    featured: Boolean(data.featured)
  }, db);
  await run(db, "DELETE FROM salon_portfolio WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  await syncSalonPostCount(salonUserId, db);
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

export async function deleteSalonPortfolio(id, salonUserId) {
  const db = await getDb();
  if (await postsRepo.deletePost(id, salonUserId, db)) {
    await syncSalonPostCount(salonUserId, db);
    return true;
  }
  const result = await run(db, "DELETE FROM salon_portfolio WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  return result.rowCount > 0;
}
