import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import { ArtistPublicPageClient } from "./ArtistPublicPageClient";
import { getSiteUrl } from "../../lib/siteUrl.js";

export const runtime = "nodejs";

// Same single source of truth as app/sitemap.js, app/robots.js and
// app/layout.jsx's metadataBase — never hardcode the domain a second time.
const SITE_URL = getSiteUrl();

async function loadArtist(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  await ensureDb();
  const artist = await artists.getPublicArtist(userId, null);
  if (!artist) return null;
  // An artist switched to "خصوصی" in تنظیمات → ویترین عمومی آرتیست must stay
  // hidden here too — GET /api/artists/[id] enforces the exact same rule for
  // any viewer who isn't the owner, and this standalone public route never
  // has a logged-in viewer to be the owner.
  if (!artist.isPublic) return null;
  // Round-tripping through JSON.stringify/parse guarantees plain
  // objects/arrays throughout (posts/services/bookedSlots) before crossing
  // the "use client" ArtistPublicPageClient RSC boundary.
  return JSON.parse(JSON.stringify(artist));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const artist = await loadArtist(id);
  if (!artist) {
    return { title: "آرتیست پیدا نشد | فرفرو" };
  }

  const serviceCount = Array.isArray(artist.services) ? artist.services.length : 0;
  const facts = [];
  if (artist.area) facts.push(`در ${artist.area}`);
  if (serviceCount > 0) facts.push(`${serviceCount} خدمت قابل رزرو`);

  const description = facts.length
    ? `${artist.name} ${facts.join(" · ")} — رزرو آنلاین نوبت در فرفرو.`
    : `پروفایل و رزرو آنلاین نوبت ${artist.name} در فرفرو.`;

  const title = `${artist.name} | فرفرو`;
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

// Builds Person JSON-LD from real artist fields only.
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
  return jsonLd;
}

export default async function ArtistPublicPage({ params }) {
  const { id } = await params;
  const artist = await loadArtist(id);
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
