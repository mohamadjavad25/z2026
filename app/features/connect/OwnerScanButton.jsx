"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { ScanFlow } from "./ScanFlow";

/**
 * «اسکن» for salons and artists (customers page): scan a client's code to
 * connect them, or another salon/artist to invite / join a team.
 */
export function OwnerScanButton({ viewerType, label = "اسکن کن", onChanged }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="cnScanCustomerBtn" onClick={() => setOpen(true)}>
        <ScanLine size={17} aria-hidden="true" />
        {label}
      </button>
      {open ? (
        <ScanFlow viewerType={viewerType} onChanged={onChanged} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
