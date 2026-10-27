import { notFound } from "next/navigation";
import { PageUnavailable } from "../../components/PageUnavailable";
import { suspendedAccountIds } from "../../lib/db/repos/users.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import { ArtistPublicPageClient } from "./ArtistPublicPageClient";
import { getSiteUrl } from "../../lib/siteUrl.js";
import { instagramUrl } from "../../shared/lib/instagram.js";
import { createShortCache } from "../../lib/shortCache.js";

export const runtime = "nodejs";

// Same single source of truth as app/sitemap.js, app/robots.js and
// app/layout.jsx's metadataBase — never hardcode the domain a second time.
const SITE_URL = getSiteUrl();

// Opened by many visitors at once (a shared link, a QR code): the page builds from this answer, and both
// generateMetadata and the page itself ask for it, so it is computed once per few seconds instead of twice per visit.
const publicCache = createShortCache({ ttlMs: 5000, max: 300 });
const loadArtist = (id) => publicCache.get(String(id), () => loadArtistFresh(id));

async function loadArtistFresh(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  await ensureDb();
  // A suspended account has no public page: `{ unavailable: true }` makes the page say so in one sentence.
  if ((await suspendedAccountIds([userId])).has(userId)) return { unavailable: true };
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
  // The page never shows the number, and it is the artist's login phone: it stays out of the HTML.
  const { phone: _loginPhone, ...shown } = artist;
  return JSON.parse(JSON.stringify(shown));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const artist = await loadArtist(id);
  if (artist?.unavailable) return { title: "صفحه در دسترس نیست | frfro", robots: { index: false } };
  if (!artist) {
    return { title: "آرتیست پیدا نشد | frfro" };
  }

  const serviceCount = Array.isArray(artist.services) ? artist.services.length : 0;
  const facts = [];
  if (artist.area) facts.push(`در ${artist.area}`);
  if (serviceCount > 0) facts.push(`${serviceCount} خدمت قابل رزرو`);

  const description = facts.length
    ? `${artist.name} ${facts.join(" · ")} — رزرو آنلاین نوبت در frfro.`
    : `پروفایل و رزرو آنلاین نوبت ${artist.name} در frfro.`;

  const title = `${artist.name} | frfro`;
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
  if (artist.service) jsonLd.jobTitle = `آرتیست ${artist.service}`;
  if (artist.instagram) jsonLd.sameAs = [instagramUrl(artist.instagram)];
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
  if (artist?.unavailable) return <PageUnavailable />;
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
