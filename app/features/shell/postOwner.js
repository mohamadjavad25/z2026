/**
 * Whose page a post opens (the viewer's own, a salon's, an artist's), worked out from the post and what is loaded.
 * Plain functions, moved out of useShellNavigation; they read nothing but their arguments.
 */
export function resolvePostOwner(post, { salonDirectory, createdProfile }) {
  if (!post) return null;
  const fromDirectory = salonDirectory.find((salon) => (
    salon.name === post.salon
    || String(salon.id) === String(post.ownerUserId)
    || String(salon.source_key) === String(post.ownerUserId)
  ));
  const isOwnPost = Boolean(
    createdProfile
    && (createdProfile.type === "artist" || createdProfile.type === "salon")
    && (
      String(post.ownerUserId) === String(createdProfile.id)
      || createdProfile.data?.name === post.salon
    )
  );

  if (isOwnPost) {
    return {
      id: createdProfile.id,
      name: createdProfile.data.name,
      area: createdProfile.data.area || post.area || "",
      role: createdProfile.data.service || post.tag || (createdProfile.type === "salon" ? "سالن" : "آرتیست"),
      source: createdProfile.type === "salon"
        ? (fromDirectory || null)
        : createdProfile,
      kind: "self",
      entityType: createdProfile.type
    };
  }

  if (post.ownerType === "salon" || fromDirectory) {
    return {
      id: fromDirectory?.id || post.ownerUserId,
      name: fromDirectory?.name || post.salon || "سالن",
      area: fromDirectory?.area || post.area || "",
      role: fromDirectory?.tag || post.tag || "سالن",
      source: fromDirectory || null,
      kind: "salon",
      entityType: "salon"
    };
  }

  return {
    id: post.ownerUserId,
    name: post.salon || "آرتیست",
    area: post.area || "",
    role: post.ownerService ? `آرتیست ${post.ownerService}` : (post.tag || "آرتیست"),
    source: null,
    kind: "artist",
    entityType: "artist"
  };
}

/** The signed-in salon as its public page shows it: the directory's row when it is loaded, else built from the owner's own lists. */
export function buildOwnPublicSalon({ salonDirectory, createdProfile, salonPortfolioList, salonStaffList, salonServiceList }) {
  const fromDirectory = salonDirectory.find((salon) => (
    String(salon.id) === String(createdProfile?.id)
    || String(salon.source_key) === String(createdProfile?.id)
    || salon.name === createdProfile?.data?.name
  ));
  if (fromDirectory) {
    return {
      ...fromDirectory,
      portfolio: fromDirectory.portfolio?.length ? fromDirectory.portfolio : salonPortfolioList,
      staff: fromDirectory.staff?.length ? fromDirectory.staff : salonStaffList,
      services: fromDirectory.services?.length ? fromDirectory.services : salonServiceList
    };
  }
  if (createdProfile?.type !== "salon") return null;
  return {
    id: createdProfile.id,
    source_key: String(createdProfile.id),
    name: createdProfile.data?.name || "سالن",
    area: createdProfile.data?.area || "",
    tag: createdProfile.data?.tag || createdProfile.data?.service || "سالن",
    open: createdProfile.data?.open || "امروز",
    avatar: createdProfile.data?.avatar || "",
    post_count: salonPortfolioList.length,
    follower_count: Number(createdProfile.data?.follower_count || 0),
    following_count: Number(createdProfile.data?.following_count || 0),
    portfolio: salonPortfolioList,
    staff: salonStaffList,
    services: salonServiceList
  };
}
