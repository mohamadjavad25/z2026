import { notFound } from "next/navigation";
import { PageUnavailable } from "../../components/PageUnavailable";
import { suspendedAccountIds } from "../../lib/db/repos/users.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { SalonPublicPageClient } from "./SalonPublicPageClient";
import { getSiteUrl } from "../../lib/siteUrl.js";
import { createShortCache } from "../../lib/shortCache.js";

export const runtime = "nodejs";

// Same single source of truth as app/sitemap.js, app/robots.js and
// app/layout.jsx's metadataBase — never hardcode the domain a second time.
const SITE_URL = getSiteUrl();

// Opened by many visitors at once (a shared link, a QR code): the page builds from this answer, and both
// generateMetadata and the page itself ask for it, so it is computed once per few seconds instead of twice per visit.
const publicCache = createShortCache({ ttlMs: 5000, max: 300 });
const loadSalon = (id) => publicCache.get(String(id), () => loadSalonFresh(id));

async function loadSalonFresh(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  await ensureDb();
  // A suspended account has no public page: `{ unavailable: true }` makes the page say so in one sentence.
  if ((await suspendedAccountIds([userId])).has(userId)) return { unavailable: true };
  const salon = await salons.getSalon(userId, null, { withTeam: true });
  if (!salon) return null;
  // A salon switched to "خصوصی" in تنظیمات → پروفایل عمومی سالن must stay
  // hidden here too — GET /api/salons/[id] enforces the exact same rule for
  // any viewer who isn't the owner, and this standalone public route never
  // has a logged-in viewer to be the owner.
  if (!salon.isPublic) return null;
  // Round-tripping through JSON.stringify/parse guarantees plain
  // objects/arrays throughout (services/portfolio/staff/hours) before
  // crossing the "use client" SalonPublicPageClient RSC boundary.
  // The page never shows the number, and it is the owner's login phone: it stays out of the HTML.
  const { phone: _loginPhone, ...shown } = salon;
  return JSON.parse(JSON.stringify(shown));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const salon = await loadSalon(id);
  if (salon?.unavailable) return { title: "صفحه در دسترس نیست | frfro", robots: { index: false } };
  if (!salon) {
    return { title: "سالن پیدا نشد | frfro" };
  }

  const serviceCount = Array.isArray(salon.services) ? salon.services.length : 0;
  const facts = [];
  if (salon.area) facts.push(`در ${salon.area}`);
  if (serviceCount > 0) facts.push(`${serviceCount} خدمت قابل رزرو`);

  const description = facts.length
    ? `${salon.name} ${facts.join(" · ")} — رزرو آنلاین نوبت در frfro.`
    : `پروفایل و رزرو آنلاین نوبت ${salon.name} در frfro.`;

  const title = `${salon.name} | frfro`;
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
// No aggregateRating: the rating/review system was removed from the
// product entirely, so there's no real data to build one from.
function buildSalonJsonLd(salon, canonicalUrl) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: salon.name,
    url: canonicalUrl
  };
  if (salon.avatar) jsonLd.image = salon.avatar;
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
  const salon = await loadSalon(id);
  if (salon?.unavailable) return <PageUnavailable />;
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
