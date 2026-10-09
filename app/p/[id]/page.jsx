import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as posts from "../../lib/db/repos/posts.js";
import { getSiteUrl } from "../../lib/siteUrl.js";

export const runtime = "nodejs";

const SITE_URL = getSiteUrl();

async function loadPost(id) {
  const postId = Number(id);
  if (!Number.isSafeInteger(postId) || postId <= 0) return null;
  await ensureDb();
  // No viewer here: only posts the owner made public resolve.
  return posts.getVisiblePost(postId, null);
}

function ownerHref(post) {
  if (post.ownerType === "salon") return `/salons/${post.ownerUserId}`;
  if (post.ownerType === "artist") return `/artists/${post.ownerUserId}`;
  return "/";
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) return { title: "نمونه‌کار پیدا نشد | Farfaroo" };
  const title = `${post.title} | ${post.salon || "Farfaroo"}`;
  const description = post.caption || `${post.title} — نمونه‌کار ${post.salon || ""} در Farfaroo.`.trim();
  const url = `${SITE_URL}/p/${post.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: post.image ? [{ url: `${SITE_URL}${post.image}` }] : undefined }
  };
}

export default async function PostPage({ params }) {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) notFound();
  return (
    <main className="ppPage">
      <article className="ppCard">
        {post.image ? <img className="ppImage" src={post.image} alt={post.title} /> : null}
        <div className="ppBody">
          <div className="ppTitleRow">
            <h1>{post.title}</h1>
            {post.tag ? <span className="ppTag">{post.tag}</span> : null}
          </div>
          {post.caption ? <p className="ppCaption">{post.caption}</p> : null}
          <Link className="ppOwner" href={ownerHref(post)}>
            <b>{post.salon}</b>
            {post.ownerArea ? <small>{post.ownerArea}</small> : null}
            <span>مشاهدهٔ پروفایل و رزرو ←</span>
          </Link>
        </div>
      </article>
    </main>
  );
}
