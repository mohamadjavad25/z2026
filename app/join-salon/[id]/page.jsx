import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { JoinSalonPageClient } from "./JoinSalonPageClient";
import { getSiteUrl } from "../../lib/siteUrl.js";

export const runtime = "nodejs";

const SITE_URL = getSiteUrl();

async function loadSalonPreview(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  await ensureDb();
  const salon = await salons.getSalonJoinPreview(userId);
  if (!salon) return null;
  // Round-tripping through JSON.stringify/parse guarantees plain
  // objects/arrays before crossing the RSC boundary — see app/salons/[id]/page.jsx.
  return JSON.parse(JSON.stringify(salon));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const salon = await loadSalonPreview(id);
  if (!salon) return { title: "لینک نامعتبر | فرفرو" };
  return {
    title: `پیوستن به تیم ${salon.name} | فرفرو`,
    description: `این لینک، تو رو به‌عنوان آرتیست به تیم «${salon.name}» در فرفرو اضافه می‌کند.`,
    alternates: { canonical: `${SITE_URL}/join-salon/${salon.id}` },
    robots: { index: false, follow: false }
  };
}

export default async function JoinSalonPage({ params }) {
  const { id } = await params;
  const salon = await loadSalonPreview(id);
  if (!salon) notFound();
  return <JoinSalonPageClient salon={salon} />;
}
