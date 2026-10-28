import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { JoinSalonPageClient } from "./JoinSalonPageClient";
import { getSiteUrl } from "../../lib/siteUrl.js";

export const runtime = "nodejs";

const SITE_URL = getSiteUrl();

async function loadSalonPreview(id, code = "") {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  await ensureDb();
  const salon = await salons.getSalonJoinPreview(userId, code);
  if (!salon) return null;
  // Round-tripping through JSON.stringify/parse guarantees plain
  // objects/arrays before crossing the RSC boundary — see app/salons/[id]/page.jsx.
  return JSON.parse(JSON.stringify(salon));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const salon = await loadSalonPreview(id);
  if (!salon) return { title: "لینک نامعتبر | frfro" };
  return {
    title: `پیوستن به تیم ${salon.name} | frfro`,
    description: `با این لینک، به‌عنوان آرتیست می‌ری توی تیم «${salon.name}» در فرفرو.`,
    alternates: { canonical: `${SITE_URL}/join-salon/${salon.id}` },
    robots: { index: false, follow: false }
  };
}

export default async function JoinSalonPage({ params, searchParams }) {
  const { id } = await params;
  const { k } = await searchParams;
  const salon = await loadSalonPreview(id, String(k || ""));
  if (!salon) notFound();
  return <JoinSalonPageClient salon={salon} joinCode={String(k || "")} />;
}
