
import { readFileSync, writeFileSync } from "node:fs";
const file = "app/styles/features/shops.css";
const lines = readFileSync(file, "utf8").split("\n");

const DEAD = new Set([
  "shopStoreSpotlight", "shopStoreSpotlightHead", "shopStoreSpotlightRail",
  "shopStoreBack", "shopStoreHeroBody", "shopStoreBrand", "shopStoreHeroBrand",
  "shopStoreHeroTitle", "shopStoreStat", "shopStoreStatIcon", "shopStorePromise",
  "shopStorePromiseItem", "shopStorePromiseIcon", "shopStoreSection",
  "shopStoreReviewsSection", "shopStoreCta", "shopStoreTopBrand",
  "shopStoreSearch", "shopStoreTopActions", "shopStoreRatingSummary"
]);
const GUARD = new Set([
  "appShell", "is-shop-store", "shopStorefront", "shopStoreHero", "shopStoreHeroImage",
  "shopStoreTopbar", "shopStoreRoundButton", "shopStoreBackButton", "shopStoreShareButton",
  "shopStoreVerifiedChip", "shopStoreIdentityCard", "shopStoreLogo", "shopStoreTitle",
  "shopStoreVerifiedIcon", "shopStoreRatingCard", "shopStoreStats", "shopStoreActions",
  "shopStoreBuyButton", "shopStoreCard", "shopStoreSectionHead", "shopStoreFilter",
  "shopStoreGrid", "shopStoreProduct", "shopStoreProductMedia", "shopStoreProductBadge",
  "shopStoreProductSoldOut", "shopStoreProductQty", "shopStoreProductLike",
  "shopStoreProductBody", "shopStoreProductMeta", "shopStorePrice", "shopStoreReviewsCard",
  "shopStoreReviews", "shopStoreEmptyState", "shopStoreEmptyIcon", "shopStoreEmptyReviews",
  "shopStoreReviewAvatar", "shopStoreReviewMeta", "shopStoreInfoStrip", "shopStoreDock",
  "shopStoreDockCart", "shopStoreDockIcon", "shopStoreDockCopy", "shopStoreDockChat",
  "shopStoreSheet", "shopStoreSheetBackdrop", "shopCartSheet", "shopCartList",
  "shopCartRow", "shopCartRowMain", "shopCartRowQty", "shopCartSummary",
  "shopCartCheckout", "shopCartEmpty", "shopChatSheet", "shopChatThread",
  "shopChatBubble", "shopChatQuick", "shopChatComposer", "sheetHandle", "sheetHead",
  "shopCard", "shopCardImage", "shopCardBadge", "shopCardBody", "shopCardTag",
  "shopCardMeta", "shopsPanel", "categoryRail", "exploreHead", "shopTeal",
  "shopPlum", "shopRose", "boardHead", "btn", "shopStoreProductBadge", "badge"
]);
const clsRe = /\.([A-Za-z][A-Za-z0-9_-]*)/g;

// ── Pass A: remove orphaned body blocks (declarations at depth 0 until a } that goes negative) ──
const corrupt = [];
let depth = 0;
let bodyStart = -1;
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  const opens = (t.match(/{/g) || []).length;
  const closes = (t.match(/}/g) || []).length;
  if (depth === 0 && bodyStart === -1) {
    // are we looking at an orphaned declaration (no selector)?
    if (
      t && !t.startsWith("/*") && !t.startsWith("@") && !t.startsWith("}") &&
      !t.includes("{") && (t.endsWith(";") || /^[-a-z][a-z-]*\s*:/.test(t)) &&
      !/^[.#][\w-]+/.test(t)
    ) {
      bodyStart = i;
    }
  }
  depth += opens - closes;
  if (depth < 0) {
    // this } closes an orphaned body
    if (bodyStart !== -1) corrupt.push([bodyStart, i]);
    else corrupt.push([i, i]);
    depth = 0;
    bodyStart = -1;
  } else if (depth > 0 && opens > 0) {
    bodyStart = -1; // real rule started
  }
}

// ── Pass B: remove dead-class rules (correct brace parser) ──
const toDelete = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (!t || t.startsWith("@media") || t.startsWith("}") || t.startsWith("/*")) continue;
  let sel = lines[i];
  let j = i;
  while (j + 1 < lines.length && !sel.includes("{")) { j++; sel += " " + lines[j]; }
  const classes = [...sel.matchAll(clsRe)].map((m) => m[1]);
  const hasDead = classes.some((c) => DEAD.has(c));
  const hasGuard = classes.some((c) => GUARD.has(c));
  if (hasDead && !hasGuard) {
    let d = 0, sawOpen = false, found = -1;
    for (let k = i; k < lines.length; k++) {
      const s = lines[k];
      const o = (s.match(/{/g) || []).length;
      const c = (s.match(/}/g) || []).length;
      d += o - c;
      if (o > 0) sawOpen = true;
      if (sawOpen && d <= 0 && c > 0) { found = k; break; }
    }
    if (found === -1) { console.error("no close at", i + 1, t); process.exit(1); }
    toDelete.push([i, found]);
    i = found;
  }
}

const all = [...corrupt, ...toDelete].sort((a, b) => a[0] - b[0]);
const merged = [];
for (const [s, e] of all) {
  const last = merged[merged.length - 1];
  if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
  else merged.push([s, e]);
}
const deleted = new Set();
for (const [s, e] of merged) for (let k = s; k <= e; k++) deleted.add(k);
let out = lines.filter((_, idx) => !deleted.has(idx));
const cleaned = [];
let blankRun = 0;
for (const l of out) {
  if (l.trim() === "") { blankRun++; if (blankRun <= 2) cleaned.push(l); }
  else { blankRun = 0; cleaned.push(l); }
}
writeFileSync(file, cleaned.join("\n"), "utf8");
console.log("orphaned bodies:", corrupt.length, "| dead rules:", toDelete.length, "| total merged:", merged.length, "| lines:", lines.length, "->", cleaned.length);
