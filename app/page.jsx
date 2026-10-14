"use client";

import { HomeApp } from "./features/shell";

// On tablets and desktops the root layout shows the about/download page instead (LargeScreenGate).
export default function Home() {
  return <HomeApp />;
}
