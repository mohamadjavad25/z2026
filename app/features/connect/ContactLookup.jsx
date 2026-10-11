"use client";

import { useEffect, useState } from "react";
import { SkeletonList } from "../../components/Skeleton";
import { searchConnections } from "../../shared/api/connections";
import { invitePhoneOf } from "../../shared/lib/contactPicker";
import { ConnectionCard } from "./ConnectionCard";
import { InviteToFrfro } from "./InviteToFrfro";

const MAX_NUMBERS = 3; // a contact with many numbers: the first few are enough to find a business

/**
 * What frfro knows about a picked contact: each of their numbers is looked up, and
 *  - a salon/artist with that number is shown, to connect to (or book if already connected);
 *  - nobody is found -> the client invites them with a ready SMS from their own phone.
 *
 * Props:
 *  - contact: { name, phones }
 *  - onConnect(profile): connect, then open (the caller decides what "open" means)
 *  - onOpen(profile): already connected, go book
 *  - connectingId: id being connected, to disable its button
 */
export function ContactLookup({ contact, categoryLabel = "", clientName = "", connectingId = null, onConnect, onOpen }) {
  const [state, setState] = useState({ status: "searching", results: [] }); // searching | done | error

  useEffect(() => {
    let cancelled = false;
    setState({ status: "searching", results: [] });
    (async () => {
      const found = new Map();
      try {
        for (const phone of (contact?.phones || []).slice(0, MAX_NUMBERS)) {
          const { ok, data } = await searchConnections(phone);
          if (cancelled) return;
          if (!ok) throw new Error("search failed");
          for (const profile of data?.results || []) found.set(profile.id, profile);
        }
        setState({ status: "done", results: [...found.values()] });
      } catch {
        if (!cancelled) setState({ status: "error", results: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [contact]);

  const who = contact?.name || "این مخاطب";

  if (state.status === "searching") return <SkeletonList rows={1} variant="card" label="در حال پیدا کردن" />;
  if (state.status === "error") return <p className="cnNote" role="alert">پیدا کردن انجام نشد؛ دوباره امتحان کن.</p>;
  if (!contact?.phones?.length) {
    return (
      <div className="cnEmpty is-compact">
        <b>{who} شمارهٔ تلفن ندارد.</b>
        <p>یک مخاطب دیگر انتخاب کن.</p>
      </div>
    );
  }
  if (state.results.length === 0) {
    return (
      <div className="cnEmpty is-compact">
        <b>{who} هنوز در فرفرو نیست.</b>
        <p>دعوتش کن؛ بعد از ثبت‌نام می‌توانی از او نوبت بگیری.</p>
        <InviteToFrfro phone={invitePhoneOf(contact.phones)} clientName={clientName} category={categoryLabel} />
      </div>
    );
  }
  return (
    <section className="cnList" aria-live="polite" aria-label="سالن یا آرتیست پیدا شده">
      {state.results.map((profile) => (
        <ConnectionCard
          key={profile.id}
          profile={profile}
          action={profile.connected ? (
            <button type="button" className="cnPrimaryBtn" onClick={() => onOpen?.(profile)}>رزرو</button>
          ) : (
            <button type="button" className="cnPrimaryBtn" disabled={connectingId === profile.id} onClick={() => onConnect?.(profile)}>
              {connectingId === profile.id ? "…" : "وصل شو"}
            </button>
          )}
        />
      ))}
    </section>
  );
}
