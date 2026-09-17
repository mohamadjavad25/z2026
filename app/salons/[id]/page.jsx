import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { SalonPublicPageClient } from "./SalonPublicPageClient";

export const runtime = "nodejs";

function loadSalon(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  ensureDb();
  const salon = salons.getSalon(userId);
  if (!salon) return null;
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

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: salon.avatar ? [{ url: salon.avatar }] : undefined
    }
  };
}

export default async function SalonPublicPage({ params }) {
  const { id } = await params;
  const salon = loadSalon(id);
  if (!salon) {
    notFound();
  }

  return <SalonPublicPageClient salon={salon} />;
}
