"use client";

import { HomeApp } from "./features/shell";

// The root layout shows the about/download page instead on tablets and desktops, and on phones
// until the visitor taps «ورود به فرفرو» there (LargeScreenGate).
export default function Home() {
  return <HomeApp />;
}
