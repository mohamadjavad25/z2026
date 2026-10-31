"use client";

import { useState } from "react";
import { ProfileSheet } from "../features/profile/ProfileSheet";
import { LegalBody } from "./LegalPage";
import { privacyContent, termsContent } from "./content";

const DOCS = {
  terms: { href: "/terms", content: termsContent },
  privacy: { href: "/privacy", content: privacyContent }
};

/**
 * A link to /terms or /privacy that opens the text in a sheet over the current screen instead
 * of leaving it. Leaving lost a half-filled sign-up form (in the app a new tab is the same
 * window), and from settings it dropped the visitor on a bare page whose back led home.
 * The real href stays so a long-press / open-in-new-tab still works.
 */
export function LegalLink({ doc, className, children }) {
  const [open, setOpen] = useState(false);
  const { href, content } = DOCS[doc];
  return (
    <>
      <a
        href={href}
        className={className}
        onClick={(event) => {
          // Inside a <label> (the sign-up agreement) the click must not tick the box either.
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </a>
      <ProfileSheet open={open} kicker="فرفرو" title={content.title} panelClassName="legalSheet" onClose={() => setOpen(false)}>
        <div className="legalSheet__body">
          <LegalBody content={content} />
        </div>
      </ProfileSheet>
    </>
  );
}
