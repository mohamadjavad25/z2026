"use client";

import { HomeContext } from "./HomeContext";
import { HomeView } from "./HomeView";
import { useHomeApp } from "./useHomeApp";

/** The signed-in / signed-out home shell: one hook builds the shared state, one view renders it. */
export function HomeApp() {
  const home = useHomeApp();
  return (
    <HomeContext.Provider value={home}>
      <HomeView />
    </HomeContext.Provider>
  );
}
