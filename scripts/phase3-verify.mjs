
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("shots/phase3", { recursive: true });
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") consoleErrors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 200));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable"); await send("Page.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); }
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(600); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(6500); await ev("document.documentElement.style.scrollBehavior='auto'"); }
async function openShop(name) {
  await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()'); await sleep(1100);
  await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes(' + JSON.stringify(name) + ')); if (el) el.click(); return !!el; })()'); await sleep(2300);
}
const rect = (sel) => '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, color: cs.color, border: cs.border, disp: cs.display }; })()';
const report = {};

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();

// ── EMPTY shop (گلوری): chip state, no stats row ──
await openShop("گلوری");
const getTopRow = '(() => { const logo = document.querySelector(".shopStoreLogo").getBoundingClientRect(); const title = document.querySelector(".shopStoreTitle").getBoundingClientRect(); const rating = document.querySelector(".shopStoreRatingCard").getBoundingClientRect(); const chip = document.querySelector(".shopStoreNewChip")?.getBoundingClientRect(); const addr = document.querySelector(".shopStoreTitle span").getBoundingClientRect(); return { logo: { x: Math.round(logo.x), y: Math.round(logo.y), w: Math.round(logo.width), h: Math.round(logo.height), cy: Math.round(logo.y + logo.height / 2) }, title: { x: Math.round(title.x), y: Math.round(title.y), w: Math.round(title.width), h: Math.round(title.height), cy: Math.round(title.y + title.height / 2) }, addr: { x: Math.round(addr.x), y: Math.round(addr.y), w: Math.round(addr.width) }, rating: { x: Math.round(rating.x), y: Math.round(rating.y), w: Math.round(rating.width), h: Math.round(rating.height), cy: Math.round(rating.y + rating.height / 2) }, chip: chip ? { x: Math.round(chip.x), y: Math.round(chip.y), w: Math.round(chip.width), h: Math.round(chip.height) } : null }; })()';
report.empty = {
  topRow: await ev(getTopRow),
  statsGone: await ev('(() => !document.querySelector(".shopStoreStats"))()'),
  chipGone: await ev('(() => !document.querySelector(".shopStoreVerifiedChip"))()'),
  back: await ev(rect(".shopStoreBackButton")),
  share: await ev(rect(".shopStoreShareButton")),
  backSvgTransform: await ev('(() => { const s = document.querySelector(".shopStoreBackButton svg"); return s ? getComputedStyle(s).transform : null; })()'),
  followers: await ev(rect(".shopStoreFollowers")),
  actions: await ev('(() => { const a = document.querySelector(".shopStoreActions"); const cs = getComputedStyle(a); const btns = [...a.querySelectorAll("button")].map(b => { const r = b.getBoundingClientRect(); return { t: b.innerText.slice(0, 14), x: Math.round(r.x), w: Math.round(r.width), c: b.className }; }); return { disp: cs.display, gap: cs.gap, btns }; })()'),
  dockIconColor: await ev('(() => { const i = document.querySelector(".shopStoreDockIcon"); return i ? getComputedStyle(i).color : null; })()'),
  dockCart: await ev(rect(".shopStoreDockCart")),
  dockChat: await ev(rect(".shopStoreDockChat")),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })'),
  identityH: await ev('(() => { const el = document.querySelector(".shopStoreIdentityCard"); return el ? Math.round(el.getBoundingClientRect().height) : null; })()')
};
await snap("p3-empty");

// ── loiih: 2 products, cart add → dock badge ──
await ev('(() => { const b = document.querySelector(".shopStoreBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1200);
await openShop("loiih");
await ev('(() => { const b = document.querySelector(".shopStoreProduct .shopStoreProductMeta button"); if (b) b.click(); return !!b; })()'); await sleep(1200);
report.loiih = {
  topRow: await ev(getTopRow),
  cartHasItems: await ev('(() => { const c = document.querySelector(".shopStoreDockCart"); return c ? { has: c.classList.contains("has-items"), badge: c.querySelector("b")?.innerText || null } : null; })()'),
  dockIconColor: await ev('(() => { const i = document.querySelector(".shopStoreDockIcon"); return i ? getComputedStyle(i).color : null; })()'),
  dockCartBg: await ev('(() => { const c = document.querySelector(".shopStoreDockCart"); return c ? getComputedStyle(c).backgroundImage.slice(0, 40) : null; })()'),
  actions: await ev('(() => { const a = document.querySelector(".shopStoreActions"); const btns = [...a.querySelectorAll("button")].map(b => { const r = b.getBoundingClientRect(); return { t: b.innerText.slice(0, 14), x: Math.round(r.x), w: Math.round(r.width) }; }); const f = a.querySelector(".shopStoreFollowers")?.getBoundingClientRect(); return { btns, followers: f ? { x: Math.round(f.x), w: Math.round(f.width) } : null }; })()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p3-loiih-cart");

// ── RATED state (seeded review) ──
await load();
await openShop("loiih");
report.rated = {
  topRow: await ev(getTopRow),
  ratingTxt: await ev('(() => document.querySelector(".shopStoreRatingCard")?.innerText?.trim().slice(0, 40) || null)()')
};
await snap("p3-rated");

// ── MOBILE ──
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await load();
await openShop("گلوری");
report.mobile = {
  topRow: await ev(getTopRow),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })'),
  dock: await ev(rect(".shopStoreDock")),
  dockIconColor: await ev('(() => { const i = document.querySelector(".shopStoreDockIcon"); return i ? getComputedStyle(i).color : null; })()')
};
await snap("p3-mobile-empty");
await ev('(() => { const b = document.querySelector(".shopStoreBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1100);
await openShop("loiih");
report.mobileLoiih = { hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })') };
await snap("p3-mobile-loiih");

report.consoleErrors = consoleErrors;
writeFileSync("shots/phase3/report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
ws.close();
