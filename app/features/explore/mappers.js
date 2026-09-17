export function mapExplorePost(post) {
  if (!post) return null;
  return {
    id: post.id,
    title: post.title,
    salon: post.salon || post.ownerName || "",
    area: post.ownerArea || post.area || "",
    tag: post.tag || "",
    meta: post.caption || post.meta || "",
    saves: post.saves || "۰",
    views: post.views || "۰",
    rating: post.rating || "",
    comments: post.comments || "۰",
    color: post.color || "teal",
    badge: post.badge || (post.featured ? "ویترین" : ""),
    tile: post.tile || "tile4",
    image: post.image || "",
    ownerUserId: post.ownerUserId,
    ownerType: post.ownerType || "",
    caption: post.caption || "",
    inExplore: post.inExplore !== false,
    featured: Boolean(post.featured)
  };
}

export function mapPortfolioItem(post) {
  if (!post) return null;
  return {
    id: post.id,
    title: post.title || "",
    tag: post.tag || "",
    saves: post.saves || "۰",
    views: post.views || "۰",
    rating: post.rating || "",
    image: post.image || "",
    caption: post.caption || "",
    inExplore: Boolean(post.inExplore),
    featured: Boolean(post.featured)
  };
}
