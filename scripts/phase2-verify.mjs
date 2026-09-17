
/**
 * Phase-2 verification: storefront rebuilt on salon pattern.
 * Desktop states + mobile + salon side-by-side + console + h-scroll.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { ensureDb, getDb } from "../app/lib/db/connection.js";

mkdirSync("shots/phase2", { recursive: true });
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") {
    consoleErrors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 220));
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    consoleErrors.push("ERR: " + (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 220));
  }
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200);
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable"); await send("Network.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase2/" + name + ".png", Buffer.from(s.result.data, "base64")); }
async function login(phone, password) {
  await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
  await sleep(600);
}
async function logout() {
  await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)');
  await send("Network.clearBrowserCookies");
  await sleep(400);
}
async function load() {
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(7000);
  await ev("document.documentElement.style.scrollBehavior='auto'; document.body.style.scrollBehavior='auto'");
}
async function tapNav(label) {
  return ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || x.getAttribute("aria-label") || "").includes(' + JSON.stringify(label) + ')); if (!b) return false; b.click(); return true; })()');
}
async function openShop(name) {
  return ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes(' + JSON.stringify(name) + ')); if (!el) return false; el.click(); return true; })()');
}
const rect = (sel) => '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), m: cs.margin, p: cs.padding, radius: cs.borderRadius, bg: cs.backgroundColor, shadow: cs.boxShadow.slice(0, 45), pos: cs.position, z: cs.zIndex, disp: cs.display, grid: cs.gridTemplateColumns }; })()';
async function hscroll() {
  return ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })');
}
async function pixels(points) {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const data = shot.result.data;
  const res = await ev('(async () => { const bmp = await createImageBitmap(await (await fetch("data:image/png;base64,' + data + '")).blob()); const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext("2d"); ctx.drawImage(bmp, 0, 0); return JSON.parse(' + JSON.stringify(JSON.stringify(points)) + ').map(p => { const d = ctx.getImageData(p[0], p[1], 1, 1).data; return [p[0], p[1], d[0], d[1], d[2]]; }); })()');
  return res;
}
const report = { errors: [], hscrolls: [] };
const addErr = (label, val) => { if (typeof val === "string" && val.startsWith("EVAL_ERR")) { report.errors.push(label + ": " + val); console.log("!!", label, val); } };

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();
await tapNav("فروشگاه"); await sleep(1200);

// ── 1) EMPTY shop (گلوری: 0 products, no rating) ──
await openShop("گلوری"); await sleep(2500);
report.geomEmpty = {
  panel: await ev(rect(".shopsPanel")),
  storefront: await ev(rect(".shopStorefront")),
  hero: await ev(rect(".shopStoreHero")),
  chip: await ev(rect(".shopStoreVerifiedChip")),
  identity: await ev(rect(".shopStoreIdentityCard")),
  logo: await ev(rect(".shopStoreLogo")),
  title: await ev(rect(".shopStoreTitle")),
  rating: await ev(rect(".shopStoreRatingCard")),
  newchip: await ev(rect(".shopStoreNewChip")),
  stats: await ev(rect(".shopStoreStats")),
  actions: await ev(rect(".shopStoreActions")),
  cards: await ev('(() => [...document.querySelectorAll(".shopStoreCard")].map(c => { const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return { x: Math.round(r.x), w: Math.round(r.width), shadow: cs.boxShadow.slice(0, 40) }; }))()'),
  info: await ev(rect(".shopStoreInfoStrip")),
  dock: await ev(rect(".shopStoreDock")),
  dockCart: await ev(rect(".shopStoreDockCart")),
  dockChat: await ev(rect(".shopStoreDockChat")),
  navHidden: await ev('(() => { const b = document.querySelector(".bottomNav"); return b ? getComputedStyle(b).display : "no-el"; })()'),
  hscroll: await hscroll()
};
const px1 = await pixels([[497, 300], [700, 120], [850, 200], [850, 230], [891, 235], [521, 60]]);
report.pxEmpty = px1;
addErr("empty geom", JSON.stringify(report.geomEmpty));
await snap("shop-empty");

// ── 2) FEW products (loiih: 2 products) ──
await ev('(() => { const b = document.querySelector(".shopStoreBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1500);
await openShop("loiih"); await sleep(2500);
report.hscrollFew = await hscroll();
const filt = await ev('(() => [...document.querySelectorAll(".shopStoreFilter button")].map(b => b.innerText))()');
report.filters = filt;
await snap("shop-few");

// cart add
await ev('(() => { const b = document.querySelector(".shopStoreProduct .shopStoreProductMeta button"); if (b) b.click(); return !!b; })()'); await sleep(1200);
report.cartDock = {
  hasItems: await ev('(() => { const c = document.querySelector(".shopStoreDockCart"); return c ? c.classList.contains("has-items") : false; })()'),
  badge: await ev('(() => document.querySelector(".shopStoreDockCart b")?.innerText || null)()'),
  dock: await ev(rect(".shopStoreDock")),
  cart: await ev(rect(".shopStoreDockCart"))
};
await snap("shop-cart");

// follow
await ev('(() => { const b = document.querySelector(".shopStoreActions button"); if (b) b.click(); return !!b; })()'); await sleep(1500);
report.followState = await ev('(() => { const b = document.querySelector(".shopStoreActions button"); return b ? { txt: b.innerText, cls: b.className } : null; })()');
await snap("shop-followed");

// ── 3) MANY products + RATED (after reload; seeded data) ──
await load();
await tapNav("فروشگاه"); await sleep(1200);
await openShop("loiih"); await sleep(2500);
report.geomMany = {
  ratingCard: await ev(rect(".shopStoreRatingCard")),
  ratingTxt: await ev('(() => document.querySelector(".shopStoreRatingCard")?.innerText?.trim().slice(0, 60) || null)()'),
  productCount: await ev('(() => document.querySelectorAll(".shopStoreProduct").length)()'),
  reviewsCount: await ev('(() => document.querySelectorAll(".shopStoreReviews article").length)()'),
  hscroll: await hscroll()
};
await snap("shop-many-rated");

// share
await ev('(() => { const b = document.querySelector(".shopStoreShareButton"); if (b) b.click(); return !!b; })()'); await sleep(1500);
report.toast = await ev('(() => document.querySelector(".appToast span")?.innerText || null)()');
await snap("shop-share");

// ── 4) OWN shop (owner گلوری) ──
await logout();
await login("09124445566", "password123");
await load();
await tapNav("فروشگاه"); await sleep(1200);
await openShop("گلوری"); await sleep(2500);
report.ownShop = {
  dockExists: await ev('(() => !!document.querySelector(".shopStoreDock"))()'),
  emptyCopy: await ev('(() => document.querySelector(".shopStoreEmptyState")?.innerText?.trim().slice(0, 80) || null)()'),
  actionsBtn: await ev('(() => [...document.querySelectorAll(".shopStoreActions button")].map(b => ({ t: b.innerText.slice(0, 20), c: b.className })))()'),
  hscroll: await hscroll()
};
await snap("shop-own");

// ── 5) SALON side-by-side ──
await logout();
await login("09121112233", "password123");
await load();
await tapNav("سالن"); await sleep(1500);
await ev('(() => { const el = document.querySelector(".salonRow"); if (el) el.click(); return !!el; })()'); await sleep(2500);
report.salon = {
  hero: await ev(rect(".salonPublicHero")),
  identity: await ev(rect(".salonPublicIdentityCard")),
  dock: await ev(rect(".salonPublicBottomDock")),
  hscroll: await hscroll()
};
await snap("salon-public");

// ── 6) REAL MOBILE 390x844 ──
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await load();
await tapNav("فروشگاه"); await sleep(1200);
await openShop("loiih"); await sleep(2500);
report.mobile = {
  hero: await ev(rect(".shopStoreHero")),
  identity: await ev(rect(".shopStoreIdentityCard")),
  logo: await ev(rect(".shopStoreLogo")),
  dock: await ev(rect(".shopStoreDock")),
  hscroll: await hscroll(),
  vw: await ev("window.innerWidth")
};
await snap("shop-mobile-many");
await ev('(() => { const b = document.querySelector(".shopStoreBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1200);
await openShop("گلوری"); await sleep(2500);
report.mobileEmpty = { hscroll: await hscroll() };
await snap("shop-mobile-empty");

// cleanup DB
ensureDb();
const db = getDb();
db.prepare("DELETE FROM shop_products WHERE id > 2 AND shop_user_id = 10").run();
db.prepare("DELETE FROM reviews WHERE id > 1").run();
db.prepare("DELETE FROM follows WHERE follower_user_id = 11 AND target_user_id = 10").run();

report.consoleErrors = consoleErrors;
writeFileSync("shots/phase2/report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
ws.close();
