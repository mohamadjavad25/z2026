"use client";

import { useEffect, useMemo, useState } from "react";
import { ProfileGallery } from "../profile/ProfileGallery";
import { getArtistTeamPosts } from "../../shared/api/artists";

/**
 * Artist owner — overview gallery (nomone-kar showcase).
 * Presentational: gallery data + callbacks from useArtistWorkspace / HomeApp.
 */
export function ArtistOverviewReviews({
  galleryItems = [],
  galleryTags = [],
  galleryFilter = "همه",
  onGalleryFilterChange,
  onAddWork,
  onItemClick,
  composeValue,
  onComposeChange,
  onComposeClose,
  onComposeSubmit,
  onComposeDelete,
  onComposeNotify,
  onComposeImageClear,
  composeTagOptions = [],
  composeTagMenuOpen = false,
  onComposeTagMenuOpenChange,
  loading = false
}) {
  // Where each post stands with the salons the artist is on the team of (owner's decision 2026-10-26: a post goes on
  // a salon's page only once the salon approves it). Fetched again whenever the post sheet closes.
  const [teamPosts, setTeamPosts] = useState({ teams: [], statuses: {} });
  const composing = Boolean(composeValue);
  useEffect(() => {
    if (composing) return undefined;
    let live = true;
    getArtistTeamPosts()
      .then((result) => {
        if (live && result.ok) setTeamPosts({ teams: result.data?.teams || [], statuses: result.data?.statuses || {} });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [composing, galleryItems.length]);

  const items = useMemo(() => galleryItems.map((item) => {
    const states = Object.values(teamPosts.statuses[item.id] || {});
    const teamFlag = states.includes("approved") ? "approved" : states.includes("pending") ? "pending" : "";
    return teamFlag ? { ...item, teamFlag } : item;
  }), [galleryItems, teamPosts.statuses]);

  const isNew = composeValue && (String(composeValue.id).startsWith("new-") || composeValue.id === "new");
  const composeSalons = composeValue
    ? teamPosts.teams.map((team) => ({ ...team, status: isNew ? null : teamPosts.statuses[composeValue.id]?.[team.salonId] || null }))
    : [];

  return (
    <div className="artistDashboard">
      <ProfileGallery
        label="گالری نمونه‌کار آرتیست"
        items={items}
        filters={galleryTags}
        activeFilter={galleryFilter}
        onFilterChange={onGalleryFilterChange}
        onAdd={onAddWork}
        addLabel="نمونه‌کار تازه"
        onItemClick={onItemClick}
        composeValue={composeValue}
        onComposeChange={onComposeChange}
        onComposeClose={onComposeClose}
        onComposeSubmit={onComposeSubmit}
        onComposeDelete={onComposeDelete}
        onComposeNotify={onComposeNotify}
        onComposeImageClear={onComposeImageClear}
        composeTagOptions={composeTagOptions}
        composeTagMenuOpen={composeTagMenuOpen}
        onComposeTagMenuOpenChange={onComposeTagMenuOpenChange}
        composeAriaLabel="ویرایش نمونه‌کار"
        composeSalons={composeSalons}
        loading={loading}
      />
    </div>
  );
}
