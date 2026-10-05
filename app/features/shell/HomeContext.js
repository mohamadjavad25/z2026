"use client";

import { createContext, useContext } from "react";

/** Everything the home shell's screens share (session, profile, workspaces, sheets, toasts...). Built once by useHomeApp and read with useHome() -- screens destructure only what they use instead of receiving dozens of props. */
export const HomeContext = createContext(null);

export function useHome() {
  const value = useContext(HomeContext);
  if (!value) throw new Error("useHome must be used inside <HomeContext.Provider>");
  return value;
}
