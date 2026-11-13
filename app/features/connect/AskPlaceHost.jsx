"use client";

import { useEffect, useState } from "react";
import { ContactRequestFlow } from "./ContactRequestFlow";
import { requestBookElsewhere } from "../booking/rebookBus";

export const ASK_PLACE = "frfro:ask-place";

/** «کاری که می‌خوای اینجا نیست؟» on a salon's or artist's page: `place` is { id, type, name }. */
export function askPlace(place) {
  if (typeof window === "undefined" || !place?.id) return;
  window.dispatchEvent(new CustomEvent(ASK_PLACE, { detail: { id: Number(place.id), type: place.type === "artist" ? "artist" : "salon", name: place.name || "" } }));
}

/**
 * The client's request to the place whose page is open, for a service not on its menu (owner, 2026-11-12: a salon had
 * only «پکیج مانیکور و پدیکور» and the client wanted pedicure alone). The service and the day and hour are picked
 * here, and it goes to that place as a normal request («توی خدماتت نیست» on the place's side). When the place does have
 * the service after all, a salon's booking form opens on that day and hour.
 */
export function AskPlaceHost({ clientName = "" }) {
  const [place, setPlace] = useState(null);
  useEffect(() => {
    const open = (event) => setPlace(event.detail || null);
    window.addEventListener(ASK_PLACE, open);
    return () => window.removeEventListener(ASK_PLACE, open);
  }, []);
  if (!place) return null;
  return (
    <ContactRequestFlow
      key={place.id}
      place={place}
      clientName={clientName}
      onFound={(found, { services = [], date, time } = {}) => {
        setPlace(null);
        if (place.type !== "artist" && services.length) requestBookElsewhere({ place: found, prefill: { names: services.slice(0, 1), day: date, time } });
      }}
      onClose={() => setPlace(null)}
    />
  );
}
