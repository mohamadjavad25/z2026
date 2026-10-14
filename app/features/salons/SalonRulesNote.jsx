"use client";

import { ScrollText } from "lucide-react";

/**
 * A salon's rules, shown to the artist at the moment they join or are invited.
 * Renders nothing when the salon wrote none. `open` expands it by default
 * (use it where the artist is deciding); otherwise it is one tap to read.
 */
export function SalonRulesNote({ rules = "", open = false }) {
  const text = String(rules || "").trim();
  if (!text) return null;
  return (
    <details className="salonRulesNote" open={open}>
      <summary>
        <ScrollText size={15} aria-hidden="true" />
        قوانین سالن
      </summary>
      <p>{text}</p>
    </details>
  );
}
