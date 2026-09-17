
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 180));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 180));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 20000); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 180); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function load() {
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(22000);
  let ready = false;
  for (let i = 0; i < 8; i++) {
    const r = await ev("(() => !!document.querySelector('.appShell'))()");
    if (r === true) { ready = true; break; }
    await sleep(8000);
  }
  await ev("document.documentElement.style.scrollBehavior='auto'");
  await sleep(600);
  return ready;
}
await send("Runtime.enable"); await send("DOM.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); }
async function login(phone, password) {
  for (let i = 0; i < 5; i++) {
    const r = await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
    if (typeof r === "string" && r.startsWith("EVAL_ERR")) { await sleep(3000); continue; }
    if (r && typeof r === "object" && !r.timeout) break;
    await sleep(3000);
  }
  await sleep(600);
}
async function setFile(selector, path) {
  const doc = await send("DOM.getDocument", { depth: -1 });
  const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector });
  if (!q.result.nodeId) return false;
  await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [path] });
  return true;
}
const out = {};

console.error("STEP:shop-owner");
// ── SHOP OWNER (گلوری) ──
console.error("STEP:start");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09124445566", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()'); await sleep(3000);
console.error("STEP:shop-profile-loaded");
out.shopOwner = {
  creatorBtn: await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); return b ? { aria: b.getAttribute("aria-label") } : null; })()'),
  wrap: await ev('(() => { const w = document.querySelector(".profileStoryAvatarWrap"); return w ? !!w : false; })()')
};
console.error("STEP:shop-creator-click");
if (out.shopOwner.creatorBtn) {
  await ev('(() => document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon").click())()');
  await sleep(600);
  out.shopOwner.overlayTitle = await ev('(() => document.querySelector(".salonStoryCreatorHead h3")?.innerText || null)()');
  out.shopOwner.overlayLabel = await ev('(() => document.querySelector(".salonStoryCreatorHead span")?.innerText?.trim() || null)()');
  const fileOk = await setFile(".salonStoryCreatorUploads input[accept='video/*']", "shots/phase3/test-story.mp4");
  await sleep(800);
  out.shopOwner.fileSet = fileOk;
  out.shopOwner.previewHasVideo = await ev('(() => document.querySelector(".salonStoryCreatorPreview")?.classList.contains("has-video") || false)()');
  await ev('(() => { const b = document.querySelector(".salonStoryPublishButton"); if (b) b.click(); return !!b; })()');
  await sleep(800);
  out.shopOwner.toast = await ev('(() => document.querySelector(".appToast span")?.innerText || null)()');
  await snap("p8-owner-shop-story-created");

  // open own storefront → logo click → video story opens
  await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()'); await sleep(1400);
  await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()'); await sleep(3500);
  out.shopOwner.hasVideoSrc = await ev('(() => { const v = document.querySelector(".shopStoreHero video"); return v ? v.getAttribute("src")?.slice(0, 40) || null : null; })()');
  await ev('(() => document.querySelector(".shopStoreLogo")?.click())()'); await sleep(600);
  out.shopOwner.storyOpen = await ev('(() => document.querySelector(".shopStorefront")?.classList.contains("is-story-open") || false)()');
  await snap("p8-owner-shop-story-play");
}

console.error("STEP:salon-owner");
// ── SALON OWNER ──
await login("09123334455", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()'); await sleep(3000);
out.salonOwner = {
  creatorBtn: await ev('(() => !!document.querySelector(".salonHeroAvatarFrame .salonHeroStoryCreateIcon"))()')
};
if (out.salonOwner.creatorBtn) {
  await ev('(() => document.querySelector(".salonHeroAvatarFrame .salonHeroStoryCreateIcon").click())()');
  await sleep(500);
  const fileOk = await setFile(".salonStoryCreatorUploads input[accept='video/*']", "shots/phase3/test-story.mp4");
  await sleep(700);
  await ev('(() => { const b = document.querySelector(".salonStoryPublishButton"); if (b) b.click(); return !!b; })()');
  await sleep(700);
  out.salonOwner.toast = await ev('(() => document.querySelector(".appToast span")?.innerText || null)()');
  // own salon public
  await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("سالن")); if (b) b.click(); return !!b; })()'); await sleep(1400);
  await ev('(() => { const el = document.querySelector(".salonRow"); if (el) el.click(); return !!el; })()'); await sleep(3500);
  await ev('(() => document.querySelector(".salonPublicLogoSlot")?.click())()'); await sleep(600);
  out.salonOwner.storyOpen = await ev('(() => document.querySelector(".salonPublicProfile")?.classList.contains("is-story-open") || false)()');
  await snap("p8-owner-salon-story-play");
}

console.error("STEP:artist-owner");
// ── ARTIST OWNER (الهام) ──
await login("09122223344", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()'); await sleep(3000);
out.artistOwner = {
  creatorBtn: await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); return b ? b.getAttribute("aria-label") : null; })()')
};
if (out.artistOwner.creatorBtn) {
  await ev('(() => document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon").click())()');
  await sleep(500);
  out.artistOwner.overlayLabel = await ev('(() => document.querySelector(".salonStoryCreatorHead span")?.innerText?.trim() || null)()');
  const fileOk = await setFile(".salonStoryCreatorUploads input[accept='video/*']", "shots/phase3/test-story.mp4");
  await sleep(700);
  await ev('(() => { const b = document.querySelector(".salonStoryPublishButton"); if (b) b.click(); return !!b; })()');
  await sleep(700);
  out.artistOwner.toast = await ev('(() => document.querySelector(".appToast span")?.innerText || null)()');
  await snap("p8-owner-artist-story-created");
}

console.error("STEP:done");
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
console.error("DONE-MARKER");
ws.close();
