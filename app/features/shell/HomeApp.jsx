"use client";

import { useEffect } from "react";
import { applyRole } from "../../shared/lib/theme";
import { HomeContext } from "./HomeContext";
import { HomeView } from "./HomeView";
import { useHomeApp } from "./useHomeApp";

/** The signed-in / signed-out home shell: one hook builds the shared state, one view renders it. */
export function HomeApp() {
  const home = useHomeApp();
  const profileType = home.createdProfile?.type;
  // Salons and artists get the violet accent, everyone else (clients, signed-out) the pink one.
  useEffect(() => { applyRole(profileType); }, [profileType]);
  return (
    <HomeContext.Provider value={home}>
      <HomeView />
    </HomeContext.Provider>
  );
}
