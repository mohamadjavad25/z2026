import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import { ArtistPublicPageClient } from "./ArtistPublicPageClient";

export const runtime = "nodejs";

function loadArtist(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  ensureDb();
  const artist = artists.getPublicArtist(userId, null);
  if (!artist) return null;
  // node:sqlite's .all()/.get() rows are null-prototype objects. That's fine
  // for JSON.stringify (used by the API routes), but React's RSC boundary
  // rejects null-prototype objects when passing this Server Component's data
  // down to the "use client" ArtistPublicPageClient. Round-tripping through
  // JSON strips the prototype and gives plain objects/arrays throughout
  // (posts/services/reviews/bookedSlots), which is what the client boundary needs.
  return JSON.parse(JSON.stringify(artist));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const artist = loadArtist(id);
  if (!artist) {
    return { title: "آرتیست پیدا نشد | زیبابان" };
  }

  const serviceCount = Array.isArray(artist.services) ? artist.services.length : 0;
  const ratingValue = Number(artist.rating);
  const facts = [];
  if (artist.area) facts.push(`در ${artist.area}`);
  if (Number.isFinite(ratingValue) && ratingValue > 0) facts.push(`امتیاز ${ratingValue.toFixed(1)} از ۵`);
  if (serviceCount > 0) facts.push(`${serviceCount} خدمت قابل رزرو`);

  const description = facts.length
    ? `${artist.name} ${facts.join(" · ")} — رزرو آنلاین نوبت در زیبابان.`
    : `پروفایل و رزرو آنلاین نوبت ${artist.name} در زیبابان.`;

  const title = `${artist.name} | زیبابان`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: artist.avatar ? [{ url: artist.avatar }] : undefined
    }
  };
}

export default async function ArtistPublicPage({ params }) {
  const { id } = await params;
  const artist = loadArtist(id);
  if (!artist) {
    notFound();
  }

  return <ArtistPublicPageClient artist={artist} />;
}
