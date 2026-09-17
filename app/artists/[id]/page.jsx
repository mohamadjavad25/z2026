import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import { ArtistPublicPageClient } from "./ArtistPublicPageClient";

export const runtime = "nodejs";

// Same single source of truth as app/sitemap.js, app/robots.js and
// app/layout.jsx's metadataBase — never hardcode the domain a second time.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zibaban.example.com";

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
  const canonicalUrl = `${SITE_URL}/artists/${artist.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: artist.avatar ? [{ url: artist.avatar }] : undefined
    }
  };
}

// Builds Person JSON-LD from real artist fields only. Unlike salons, artists
// DO have a real reviewCount (getPublicArtist aggregates it from the reviews
// table, not a static column) so aggregateRating is included, but only when
// there's at least one real review behind it — never as a fabricated 0/5.
function buildArtistJsonLd(artist, canonicalUrl) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: artist.name,
    url: canonicalUrl
  };
  if (artist.avatar) jsonLd.image = artist.avatar;
  if (artist.bio) jsonLd.description = artist.bio;
  if (artist.service) jsonLd.jobTitle = `آرتیست ${artist.service}`;
  if (artist.area) {
    jsonLd.address = {
      "@type": "PostalAddress",
      addressLocality: artist.area,
      addressCountry: "IR"
    };
  }
  const reviewCount = Number(artist.reviewCount || 0);
  const ratingValue = Number(artist.rating);
  if (reviewCount > 0 && Number.isFinite(ratingValue) && ratingValue > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount
    };
  }
  return jsonLd;
}

export default async function ArtistPublicPage({ params }) {
  const { id } = await params;
  const artist = loadArtist(id);
  if (!artist) {
    notFound();
  }
  const canonicalUrl = `${SITE_URL}/artists/${artist.id}`;
  const jsonLd = buildArtistJsonLd(artist, canonicalUrl);

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <ArtistPublicPageClient artist={artist} />
    </>
  );
}
