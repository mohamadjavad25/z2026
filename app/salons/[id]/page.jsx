import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { SalonPublicPageClient } from "./SalonPublicPageClient";

export const runtime = "nodejs";

// Same single source of truth as app/sitemap.js, app/robots.js and
// app/layout.jsx's metadataBase — never hardcode the domain a second time.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zibaban.example.com";

function loadSalon(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  ensureDb();
  const salon = salons.getSalon(userId);
  if (!salon) return null;
  // A salon switched to "خصوصی" in تنظیمات → پروفایل عمومی سالن must stay
  // hidden here too — GET /api/salons/[id] enforces the exact same rule for
  // any viewer who isn't the owner, and this standalone public route never
  // has a logged-in viewer to be the owner.
  if (!salon.isPublic) return null;
  // node:sqlite's .all()/.get() rows are null-prototype objects. That's fine
  // for JSON.stringify (used by the API routes), but React's RSC boundary
  // rejects null-prototype objects when passing this Server Component's data
  // down to the "use client" SalonPublicPageClient. Round-tripping through
  // JSON strips the prototype and gives plain objects/arrays throughout
  // (services/portfolio/staff/hours), which is what the client boundary needs.
  return JSON.parse(JSON.stringify(salon));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const salon = loadSalon(id);
  if (!salon) {
    return { title: "سالن پیدا نشد | زیبابان" };
  }

  const serviceCount = Array.isArray(salon.services) ? salon.services.length : 0;
  const ratingValue = Number(salon.rating);
  const facts = [];
  if (salon.area) facts.push(`در ${salon.area}`);
  if (Number.isFinite(ratingValue) && ratingValue > 0) facts.push(`امتیاز ${ratingValue.toFixed(1)} از ۵`);
  if (serviceCount > 0) facts.push(`${serviceCount} خدمت قابل رزرو`);

  const description = facts.length
    ? `${salon.name} ${facts.join(" · ")} — رزرو آنلاین نوبت در زیبابان.`
    : `پروفایل و رزرو آنلاین نوبت ${salon.name} در زیبابان.`;

  const title = `${salon.name} | زیبابان`;
  const canonicalUrl = `${SITE_URL}/salons/${salon.id}`;

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
      images: salon.avatar ? [{ url: salon.avatar }] : undefined
    }
  };
}

// Builds LocalBusiness (BeautySalon) JSON-LD from real salon fields only.
// No aggregateRating: unlike artists, salons have no reviewCount at
// all in the data model (salons.rating is a raw column that defaults to 5
// for every brand-new salon regardless of real reviews — see the flag in the
// SEO report). Fabricating an AggregateRating out of that column would be
// exactly the "unconditional fake data" pattern this project already fixed
// elsewhere, so it's omitted entirely rather than guessed at.
function buildSalonJsonLd(salon, canonicalUrl) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: salon.name,
    url: canonicalUrl
  };
  if (salon.avatar) jsonLd.image = salon.avatar;
  if (salon.bio) jsonLd.description = salon.bio;
  // Deliberately NOT emitting telephone: salon.phone is the users.phone
  // column, which is this account's LOGIN credential (see getUserByPhone in
  // app/lib/db/repos/users.js) — not a business contact number the owner
  // chose to publish. It isn't shown anywhere on SalonPublicPageClient
  // either, so putting it in crawlable, Google-cached JSON-LD would leak
  // private auth data the visible page itself never exposes. Re-add this
  // only once the data model has a distinct "public business phone" field
  // the owner explicitly opts into.
  if (salon.area) {
    jsonLd.address = {
      "@type": "PostalAddress",
      addressLocality: salon.area,
      addressCountry: "IR"
    };
  }
  return jsonLd;
}

export default async function SalonPublicPage({ params }) {
  const { id } = await params;
  const salon = loadSalon(id);
  if (!salon) {
    notFound();
  }
  const canonicalUrl = `${SITE_URL}/salons/${salon.id}`;
  const jsonLd = buildSalonJsonLd(salon, canonicalUrl);

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <SalonPublicPageClient salon={salon} />
    </>
  );
}
