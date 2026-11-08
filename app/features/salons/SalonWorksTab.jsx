"use client";

import { useMemo, useState } from "react";
import { ProfileGallery } from "../profile/ProfileGallery";
import { SalonTeamRequests, SalonTeamWorkSheet, mergeSalonWorks, teamWorkItems, useSalonTeamWorks } from "./SalonTeamPostsPanel";

const ALL = "همه";
const SALON = "سالن";

/**
 * The salon's own «نمونه‌کار» tab: its works and the team's added ones in one grid, in the order clients see them on
 * the salon's page, with the same «همه · سالن · <artist>» filter when the team has works there (owner, 2026-11-08).
 * `galleryProps` are ProfileGallery's composer and loading props, passed through unchanged.
 */
export function SalonWorksTab({ items, onOpenWork, onNotify, galleryProps }) {
  const team = useSalonTeamWorks(onNotify);
  const [filter, setFilter] = useState(ALL);
  const [openTeamWork, setOpenTeamWork] = useState(null);

  const teamWorks = useMemo(() => teamWorkItems(team.approved), [team.approved]);
  const filters = useMemo(() => {
    if (!teamWorks.length) return null;
    const names = [...new Set(teamWorks.map((item) => item.teamArtistName).filter(Boolean))];
    return [ALL, ...(items.length ? [SALON] : []), ...names];
  }, [teamWorks, items.length]);
  const activeFilter = filters?.includes(filter) ? filter : ALL;
  const shown = useMemo(() => {
    if (activeFilter === SALON) return items;
    if (activeFilter !== ALL) return teamWorks.filter((item) => item.teamArtistName === activeFilter);
    return mergeSalonWorks(items, teamWorks);
  }, [activeFilter, items, teamWorks]);

  return (
    <>
      <SalonTeamRequests team={team} />
      <ProfileGallery
        {...galleryProps}
        items={shown}
        filters={filters || undefined}
        activeFilter={activeFilter}
        onFilterChange={setFilter}
        onItemClick={(item) => (item.teamPostId ? setOpenTeamWork(item) : onOpenWork(item))}
      />
      <SalonTeamWorkSheet team={team} item={openTeamWork} onClose={() => setOpenTeamWork(null)} />
    </>
  );
}
