"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { ExternalLink, MapPin } from "lucide-react";
import { Avatar } from "./Avatar";

/** The real profile photo; the coloured initial for someone who has none. */
export function UserPhoto({ user }) {
  if (!user.has_avatar) return <Avatar name={user.name} phone={user.phone} />;
  return <img className="admAvatar admAvatarPhoto" src={`/api/media/avatar/${user.id}`} alt={`عکس پروفایل ${user.name || ""}`} />;
}

export function UserPoster({ user }) {
  if (!user.has_poster) return null;
  return <img className="admPoster" src={`/api/media/poster/${user.id}`} alt={`بنر صفحهٔ ${user.name || ""}`} />;
}

/** Where they marked themselves, on a small map that only shows; moving their pin stays with them. */
export function UserPlace({ user }) {
  const boxRef = useRef(null);
  const lat = user.geo_lat === null || user.geo_lat === undefined ? null : Number(user.geo_lat);
  const lng = user.geo_lng === null || user.geo_lng === undefined ? null : Number(user.geo_lng);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!hasPin) return undefined;
    let cancelled = false;
    let map = null;
    import("leaflet").then((module) => {
      if (cancelled || !boxRef.current) return;
      const L = module.default || module;
      map = L.map(boxRef.current, { center: [lat, lng], zoom: 15, attributionControl: false, scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: "admMapPin", iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map);
      setTimeout(() => map?.invalidateSize(), 120);
    });
    return () => {
      cancelled = true;
      map?.remove();
      map = null;
    };
  }, [hasPin, lat, lng]);

  return (
    <section className="admPlace">
      <h3><MapPin size={15} aria-hidden="true" /> جا روی نقشه</h3>
      {user.area || user.address_detail ? <p>{[user.area, user.address_detail].filter(Boolean).join(" • ")}</p> : null}
      {hasPin ? (
        <>
          <div className="admMapBox" ref={boxRef} role="img" aria-label={`جای ${user.name || "این کاربر"} روی نقشه`} />
          <a className="admLink" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`} target="_blank" rel="noreferrer">
            <ExternalLink size={14} aria-hidden="true" /> بازکردن نقشهٔ بزرگ
          </a>
        </>
      ) : <p className="admMuted">جایش را روی نقشه نزده است.</p>}
    </section>
  );
}

/** The menu as they wrote it, prices included, so a price a client would misread is easy to spot. */
export function UserServices({ services }) {
  if (!services?.length) return null;
  return (
    <section>
      <h3>خدمت‌ها</h3>
      <ul className="admFacts">
        {services.map((service) => (
          <li key={service.id}>
            <span>{service.name}</span>
            <b>{[service.price, service.duration].filter(Boolean).join(" • ") || "—"}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Their newest work as pictures. A post its owner made private is only named. */
export function UserGallery({ posts, onOpen }) {
  const shown = posts.filter((post) => post.is_public);
  if (!shown.length) return null;
  return (
    <div className="admGallery">
      {shown.map((post) => (
        <button type="button" key={post.id} onClick={() => onOpen(post)} aria-label={post.title}>
          <img src={`/api/media/post/${post.id}?w=240`} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  );
}
