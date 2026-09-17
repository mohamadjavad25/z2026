/**
 * UX empty-state + skeleton smoke (M1 / M3 / M4) — LOCAL ONLY, no live DB.
 *
 * Checks:
 * - Shared SkeletonList API renders (React SSR createElement mirror of public contract)
 * - Source wiring: AuthBootScreen, panel loading props, empty catalog/reviews JSX
 * - CSS classes for auth boot + skeleton shimmer exist
 *
 * Usage:
 *   node scripts/seed-ux-empty-skeleton-test.mjs
 *   node scripts/seed-ux-empty-skeleton-test.mjs --cleanup
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = path.join(root, "data", "zibaban-ux-empty-skeleton-test-report.json");
const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const report = [];

function step(title, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${title}${detail ? ` — ${detail}` : ""}`;
  report.push({ ok, title, detail, line });
  console.log(line);
}

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function cleanup() {
  if (existsSync(REPORT)) rmSync(REPORT, { force: true });
}

if (doCleanupOnly) {
  cleanup();
  console.log("Cleaned empty-skeleton test report.");
  process.exit(0);
}

/** Mirrors app/components/Skeleton.jsx public markup for SSR without JSX loader. */
function SkeletonBlock({ className = "" }) {
  return createElement("span", {
    className: `uxSkeletonBlock ${className}`.trim(),
    "aria-hidden": "true"
  });
}

function SkeletonList({ rows = 3, variant = "list", className = "", label = "در حال بارگذاری" }) {
  const count = Math.max(1, Number(rows) || 3);
  const items = Array.from({ length: count }, (_, index) => index);
  return createElement(
    "div",
    {
      className: `uxSkeletonList is-${variant} ${className}`.trim(),
      role: "status",
      "aria-live": "polite",
      "aria-label": label
    },
    items.map((index) =>
      createElement(
        "div",
        { className: "uxSkeletonItem", key: `sk-${variant}-${index}` },
        variant === "card" || variant === "feed"
          ? [
              createElement(SkeletonBlock, { className: "uxSkeletonMedia", key: "m" }),
              createElement(
                "div",
                { className: "uxSkeletonCopy", key: "c" },
                createElement(SkeletonBlock, { className: "uxSkeletonLine is-title" }),
                createElement(SkeletonBlock, { className: "uxSkeletonLine is-meta" })
              )
            ]
          : variant === "row"
            ? [
                createElement(SkeletonBlock, { className: "uxSkeletonAvatar", key: "a" }),
                createElement(
                  "div",
                  { className: "uxSkeletonCopy", key: "c" },
                  createElement(SkeletonBlock, { className: "uxSkeletonLine is-title" }),
                  createElement(SkeletonBlock, { className: "uxSkeletonLine is-meta" })
                ),
                createElement(SkeletonBlock, { className: "uxSkeletonChip", key: "ch" })
              ]
            : createElement(
                "div",
                { className: "uxSkeletonCopy is-full" },
                createElement(SkeletonBlock, { className: "uxSkeletonLine is-title" }),
                createElement(SkeletonBlock, { className: "uxSkeletonLine is-meta" }),
                createElement(SkeletonBlock, { className: "uxSkeletonLine is-short" })
              )
      )
    )
  );
}

function AuthBootScreen() {
  return createElement(
    "div",
    {
      className: "authBootScreen",
      role: "status",
      "aria-live": "polite",
      "aria-label": "در حال آماده‌سازی زیبابان"
    },
    createElement(
      "div",
      { className: "authBootInner" },
      createElement("p", { className: "authBootBrand" }, "زیبابان"),
      createElement("span", { className: "authBootSpinner", "aria-hidden": "true" }),
      createElement("small", null, "در حال آماده‌سازی…")
    )
  );
}

/** Structural empty-state snapshot for ShopStorefrontPage empty branches. */
function ShopStoreEmptySnapshots({ catalog = [], reviews = [] }) {
  return createElement(
    "div",
    null,
    catalog.length === 0
      ? createElement(
          "div",
          { className: "shopStoreEmptyState", role: "status" },
          createElement("b", null, "هنوز محصولی در ویترین نیست"),
          createElement("span", null, "صاحب فروشگاه هنوز کالایی منتشر نکرده؛ بعداً سر بزن یا فروشگاه دیگری را ببین."),
          createElement("button", { type: "button" }, "بازگشت به فهرست فروشگاه‌ها")
        )
      : null,
    reviews.length === 0
      ? createElement(
          "div",
          { className: "shopStoreEmptyState", role: "status" },
          createElement("b", null, "هنوز نظری ثبت نشده"),
          createElement(
            "span",
            null,
            "اولین خریداران می‌توانند تجربهٔ خود را اینجا بنویسند تا بقیه مطمئن‌تر انتخاب کنند."
          )
        )
      : null
  );
}

try {
  const listHtml = renderToStaticMarkup(
    createElement(SkeletonList, { rows: 3, variant: "list", label: "تست لیست" })
  );
  step("SkeletonList list renders", listHtml.includes("uxSkeletonList") && listHtml.includes("is-list"), `len=${listHtml.length}`);

  const cardHtml = renderToStaticMarkup(
    createElement(SkeletonList, { rows: 2, variant: "card", className: "shopStoreCatalogSkeleton" })
  );
  step("SkeletonList card renders", cardHtml.includes("is-card") && cardHtml.includes("uxSkeletonMedia"), "");

  const feedHtml = renderToStaticMarkup(createElement(SkeletonList, { rows: 4, variant: "feed" }));
  step("SkeletonList feed renders", feedHtml.includes("is-feed") && (feedHtml.match(/uxSkeletonItem/g) || []).length === 4, "");

  const rowHtml = renderToStaticMarkup(createElement(SkeletonList, { rows: 2, variant: "row" }));
  step("SkeletonList row renders", rowHtml.includes("uxSkeletonAvatar") && rowHtml.includes("uxSkeletonChip"), "");

  const bootHtml = renderToStaticMarkup(createElement(AuthBootScreen));
  step("AuthBootScreen renders brand", bootHtml.includes("زیبابان") && bootHtml.includes("authBootSpinner"), "");

  const emptyHtml = renderToStaticMarkup(createElement(ShopStoreEmptySnapshots, { catalog: [], reviews: [] }));
  step(
    "Empty catalog+reviews JSX present",
    emptyHtml.includes("shopStoreEmptyState")
      && emptyHtml.includes("هنوز محصولی در ویترین نیست")
      && emptyHtml.includes("هنوز نظری ثبت نشده")
      && emptyHtml.includes("بازگشت به فهرست فروشگاه‌ها"),
    ""
  );

  const filledHtml = renderToStaticMarkup(
    createElement(ShopStoreEmptySnapshots, {
      catalog: [{ id: 1 }],
      reviews: [{ name: "آزمایش" }]
    })
  );
  step("Non-empty skips empty states", !filledHtml.includes("shopStoreEmptyState"), "");
} catch (error) {
  step("React SSR smoke", false, String(error?.message || error));
}

const skeletonSrc = read("app/components/Skeleton.jsx");
step(
  "Skeleton.jsx exports SkeletonList + variants",
  /export function SkeletonList/.test(skeletonSrc)
    && skeletonSrc.includes('variant === "card"')
    && skeletonSrc.includes('variant === "feed"')
    && skeletonSrc.includes('variant === "row"'),
  ""
);

const bootSrc = read("app/features/shell/AuthBootScreen.jsx");
step("AuthBootScreen.jsx exists", bootSrc.includes("authBootScreen") && bootSrc.includes("زیبابان"), "");

const homeSrc = read("app/features/shell/HomeApp.jsx");
step("HomeApp mounts AuthBootScreen", homeSrc.includes("AuthBootScreen") && homeSrc.includes("{!authChecked ? <AuthBootScreen /> : null}"), "");
step("HomeApp passes exploreLoading", homeSrc.includes("loading={exploreLoading}"), "");
step("HomeApp passes walletLoading", homeSrc.includes("walletLoading={walletLoading}"), "");
step("HomeApp passes shopWorkspaceLoading", homeSrc.includes("loading={shopWorkspaceLoading}"), "");
step("HomeApp passes shopStoreLoading", homeSrc.includes("loading={shopStoreLoading}"), "");
step("HomeApp passes salonWorkspaceLoading", homeSrc.includes("loading={salonWorkspaceLoading}"), "");
step("HomeApp passes artistWorkspaceLoading", homeSrc.includes("loading={artistWorkspaceLoading}"), "");

const panels = [
  ["ExplorePage", "app/features/explore/ExplorePage.jsx", "SkeletonList", "loading"],
  ["WalletPage", "app/features/wallet/WalletPage.jsx", "SkeletonList", "walletLoading"],
  ["ShopProductsOverview", "app/features/shops/ShopProductsOverview.jsx", "SkeletonList", "loading"],
  ["ShopStorefrontPage", "app/features/shops/ShopStorefrontPage.jsx", "SkeletonList", "loading"],
  ["SalonScheduleDashboard", "app/features/schedule/SalonScheduleDashboard.jsx", "SkeletonList", "loading"],
  ["ArtistScheduleBoard", "app/features/schedule/ArtistScheduleBoard.jsx", "SkeletonList", "loading"]
];

for (const [name, rel, needle, flag] of panels) {
  const src = read(rel);
  step(`${name} uses shared SkeletonList`, src.includes(needle) && src.includes(flag), rel);
}

const storeSrc = read("app/features/shops/ShopStorefrontPage.jsx");
step(
  "ShopStorefront empty catalog branch",
  storeSrc.includes("catalog.length === 0")
    && storeSrc.includes("هنوز محصولی در ویترین نیست")
    && storeSrc.includes("shopStoreEmptyState"),
  ""
);
step(
  "ShopStorefront empty reviews branch",
  storeSrc.includes("reviews.length === 0")
    && storeSrc.includes("هنوز نظری ثبت نشده")
    && storeSrc.includes("MessageCircle"),
  ""
);

const cssShell = read("app/styles/features/shell.css");
step(
  "shell.css has auth boot + skeleton shimmer",
  cssShell.includes(".authBootScreen")
    && cssShell.includes("@keyframes uxSkeletonShimmer")
    && cssShell.includes(".shopStoreEmptyState"),
  ""
);

const cssApp = read("app/styles.css");
step(
  "styles.css auth-loading keeps boot visible",
  cssApp.includes(".appShell.is-auth-loading")
    && cssApp.includes(".authBootScreen")
    && !/is-auth-loading\{\s*opacity:\s*0/.test(cssApp.replace(/\s+/g, "")),
  ""
);

const failed = report.filter((item) => !item.ok);
writeFileSync(
  REPORT,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      passed: report.length - failed.length,
      failed: failed.length,
      total: report.length,
      lines: report.map((item) => item.line)
    },
    null,
    2
  )
);

console.log("");
console.log(`Summary: ${report.length - failed.length}/${report.length} passed`);
if (failed.length) {
  console.log("Failed:");
  for (const item of failed) console.log(`  - ${item.title}${item.detail ? `: ${item.detail}` : ""}`);
  process.exit(1);
}

console.log("Report:", REPORT);
process.exit(0);
