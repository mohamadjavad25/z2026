"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { getArtistPlace, moveArtistBookingPlace } from "../../shared/api/artists";

/**
 * «جای نوبت» in an artist's booking sheet: the salons of theirs that take direct bookings, and «مثل قبل». The booking
 * already sits where the artist's list put it; one tap here says otherwise. Hidden for an artist on no team.
 */
export function ArtistBookingPlace({ booking }) {
  const [teams, setTeams] = useState([]);
  const [current, setCurrent] = useState(booking?.placeSalon?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ bad: false, text: "" });
  useEffect(() => setCurrent(booking?.placeSalon?.id ?? null), [booking?.id, booking?.placeSalon?.id]);
  useEffect(() => {
    let alive = true;
    getArtistPlace().then(({ ok, data }) => { if (alive && ok) setTeams(data?.place?.teams || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const choices = teams.filter((team) => !team.note || team.salonId === current);
  if (!teams.length) return null;

  async function pick(salonId) {
    if (busy || salonId === current) return;
    setBusy(true);
    try {
      const { ok, payload } = await moveArtistBookingPlace(booking.id, salonId);
      if (!ok) { setMsg({ bad: true, text: payload?.error || "جا عوض نشد؛ دوباره بزن." }); return; }
      setCurrent(salonId);
      setMsg({ bad: false, text: "جای نوبت عوض شد." });
    } catch {
      setMsg({ bad: true, text: "جا عوض نشد؛ دوباره بزن." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="plBookingPlace" role="radiogroup" aria-label="جای نوبت">
      <span className="plBookingLabel"><MapPin size={15} aria-hidden="true" />جای نوبت</span>
      <div className="plChips">
        {choices.map((team) => (
          <button type="button" key={team.salonId} role="radio" aria-checked={current === team.salonId} className={current === team.salonId ? "is-on" : ""} disabled={busy} onClick={() => pick(team.salonId)}>{team.name}</button>
        ))}
        <button type="button" role="radio" aria-checked={current == null} className={current == null ? "is-on" : ""} disabled={busy} onClick={() => pick(null)}>مثل قبل</button>
      </div>
      {msg.text ? <small className={`plBookingMsg${msg.bad ? " is-bad" : ""}`} role="status">{msg.text}</small> : null}
    </div>
  );
}
