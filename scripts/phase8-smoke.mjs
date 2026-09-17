
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
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 200));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 250); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); }
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(600); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(8000); await ev("document.documentElement.style.scrollBehavior='auto'"); }
const out = {};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// CLIENT: salon public story
await login("09121112233", "password123");
await load();
out.pageLoaded = await ev('(() => !!document.querySelector(".appShell"))()');
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("سالن")); if (b) b.click(); return !!b; })()'); await sleep(1400);
await ev('(() => { const el = document.querySelector(".salonRow"); if (el) el.click(); return !!el; })()'); await sleep(2500);
out.salonLogo = await ev('(() => { const l = document.querySelector(".salonPublicLogoSlot"); return l ? { cls: l.className, role: l.getAttribute("role") } : null; })()');
await ev('(() => document.querySelector(".salonPublicLogoSlot")?.click())()'); await sleep(500);
out.salonStory = await ev('(() => { const s = document.querySelector(".salonPublicProfile"); return { empty: s.classList.contains("is-story-empty"), emptyTxt: document.querySelector(".publicStoryEmpty")?.innerText?.slice(0, 40) || null }; })()');
await snap("p8-salon-story");

// SHOP public story
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()'); await sleep(1400);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()'); await sleep(2500);
out.shopLogo = await ev('(() => { const l = document.querySelector(".shopStoreLogo"); return l ? { cls: l.className, role: l.getAttribute("role") } : null; })()');
await ev('(() => document.querySelector(".shopStoreLogo")?.click())()'); await sleep(500);
out.shopStory = await ev('(() => { const s = document.querySelector(".shopStorefront"); return { empty: s.classList.contains("is-story-empty"), emptyTxt: document.querySelector(".publicStoryEmpty")?.innerText?.slice(0, 40) || null }; })()');
await snap("p8-shop-story");

// ARTIST public story (from explore)
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("اکسپلور")); if (b) b.click(); return !!b; })()'); await sleep(1400);
out.exploreCards = await ev('(() => document.querySelectorAll(".feedCard").length)()');
await ev('(() => { const el = document.querySelector(".feedCard"); if (el) el.click(); return !!el; })()'); await sleep(2200);
out.artistOpen = await ev('(() => !!document.querySelector(".artistPublicPage"))()');
out.artistAvatar = await ev('(() => { const a = document.querySelector(".artistPublicAvatar"); return a ? { cls: a.className.slice(0, 80), role: a.getAttribute("role") } : null; })()');
if (await ev('(() => !!document.querySelector(".artistPublicAvatar"))()')) {
  await ev('(() => document.querySelector(".artistPublicAvatar")?.click())()'); await sleep(500);
  out.artistStory = await ev('(() => { const p = document.querySelector(".artistPublicPage"); return { empty: p?.classList.contains("is-story-empty"), emptyTxt: document.querySelector(".publicStoryEmpty")?.innerText?.slice(0, 40) || null }; })()');
  await snap("p8-artist-story");
}
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
