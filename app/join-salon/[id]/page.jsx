import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { JoinSalonPageClient } from "./JoinSalonPageClient";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zibaban.example.com";

function loadSalonPreview(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  ensureDb();
  const salon = salons.getSalonJoinPreview(userId);
  if (!salon) return null;
  // node:sqlite rows are null-prototype — see app/salons/[id]/page.jsx for
  // why this round-trip is needed before crossing the RSC boundary.
  return JSON.parse(JSON.stringify(salon));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const salon = loadSalonPreview(id);
  if (!salon) return { title: "لینک نامعتبر | زیبابان" };
  return {
    title: `پیوستن به تیم ${salon.name} | زیبابان`,
    description: `این لینک، تو رو به‌عنوان آرتیست به تیم «${salon.name}» در زیبابان اضافه می‌کند.`,
    alternates: { canonical: `${SITE_URL}/join-salon/${salon.id}` },
    robots: { index: false, follow: false }
  };
}

export default async function JoinSalonPage({ params }) {
  const { id } = await params;
  const salon = loadSalonPreview(id);
  if (!salon) notFound();
  return <JoinSalonPageClient salon={salon} />;
}
