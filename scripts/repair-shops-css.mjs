
import { readFileSync, writeFileSync } from "node:fs";
const file = "app/styles/features/shops.css";
let lines = readFileSync(file, "utf8").split("\n");

// ── Step 1: remove orphan selector lines (bodies were lost; duplicates survive) ──
const ORPHANS = new Set([
  ".appShell.is-shop-store .shopStoreHero {",
  ".appShell.is-shop-store .shopStoreLogo {",
  ".appShell.is-shop-store .shopStoreStats {",
  ".appShell.is-shop-store .shopStoreActions {",
  ".appShell.is-shop-store .shopStoreProductMeta button {",
  ".appShell.is-shop-store .shopStoreTopbar {",
  ".appShell.is-shop-store .shopStoreHero::before {",
  ".appShell.is-shop-store .shopStoreStatIcon.is-rating {",
  ".appShell.is-shop-store .shopStoreActions button.is-following {",
  ".appShell.is-shop-store .shopStoreProduct.is-inCart {"
]);
let removedOrphans = 0;
lines = lines.filter((l) => {
  if (ORPHANS.has(l.trim())) { removedOrphans++; return false; }
  return true;
});

// ── Step 2: remove dead-class rules (correct brace parser) ──
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
  "shopPlum", "shopRose"
]);
const clsRe = /\.([A-Za-z][A-Za-z0-9_-]*)/g;

const toDelete = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (!t || t.startsWith("@media") || t.startsWith("}") || t.startsWith("/*")) continue;
  // gather selector group
  let sel = lines[i];
  let j = i;
  while (j + 1 < lines.length && !sel.includes("{")) { j++; sel += " " + lines[j]; }
  const classes = [...sel.matchAll(clsRe)].map((m) => m[1]);
  const hasDead = classes.some((c) => DEAD.has(c));
  const hasGuard = classes.some((c) => GUARD.has(c));
  if (hasDead && !hasGuard) {
    // find rule end (correct brace counting)
    let depth = 0, sawOpen = false, found = -1;
    for (let k = i; k < lines.length; k++) {
      const s = lines[k];
      const o = (s.match(/{/g) || []).length;
      const c = (s.match(/}/g) || []).length;
      depth += o - c;
      if (o > 0) sawOpen = true;
      if (sawOpen && depth <= 0 && c > 0) { found = k; break; }
    }
    if (found === -1) { console.error("no close at", i + 1, t); process.exit(1); }
    toDelete.push([i, found]);
    i = found;
  }
}
toDelete.sort((a, b) => a[0] - b[0]);
const merged = [];
for (const [s, e] of toDelete) {
  const last = merged[merged.length - 1];
  if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
  else merged.push([s, e]);
}
const deleted = new Set();
for (const [s, e] of merged) for (let k = s; k <= e; k++) deleted.add(k);
let out = lines.filter((_, idx) => !deleted.has(idx));

// collapse blank runs
const cleaned = [];
let blankRun = 0;
for (const l of out) {
  if (l.trim() === "") { blankRun++; if (blankRun <= 2) cleaned.push(l); }
  else { blankRun = 0; cleaned.push(l); }
}
writeFileSync(file, cleaned.join("\n"), "utf8");
console.log("orphans removed:", removedOrphans, "| dead rules removed:", merged.length, "| lines:", lines.length, "->", cleaned.length);
