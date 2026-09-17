
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("shots/phase2-before", { recursive: true });
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
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error")) errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable"); await send("Page.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase2-before/" + name + ".png", Buffer.from(s.result.data, "base64")); }
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(600); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(7500); await ev("document.documentElement.style.scrollBehavior='auto'; document.body.style.scrollBehavior='auto'"); }
async function tapNav(label) { return ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || x.getAttribute("aria-label") || "").includes(' + JSON.stringify(label) + ')); if (!b) return false; b.click(); return true; })()'); }
const rect = (sel) => '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), pos: cs.position, bottom: cs.bottom, transform: cs.transform, display: cs.display }; })()';

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();

// SALON public
await tapNav("سالن"); await sleep(1500);
await ev('(() => { const el = document.querySelector(".salonRow"); if (el) el.click(); return !!el; })()');
await sleep(2500);
console.log("SALON dock:", await ev(rect(".salonPublicBottomDock")));
console.log("SALON nav visible:", await ev('(() => { const b = document.querySelector(".bottomNav"); return b ? getComputedStyle(b).display : "none-el"; })()'));
console.log("SALON profile rect:", await ev(rect(".salonPublicProfile")));
console.log("SALON hero rect:", await ev(rect(".salonPublicHero")));
console.log("SALON hero radius:", await ev('(() => { const el = document.querySelector(".salonPublicHero"); return el ? getComputedStyle(el).borderRadius : null; })()'));
await snap("salon-public-current");

// SHOP storefront
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()');
await sleep(1500);
await ev('(() => { const el = document.querySelector(".shopCard"); if (el) el.click(); return !!el; })()');
await sleep(2500);
console.log("SHOP dock:", await ev(rect(".shopStoreDock")));
console.log("SHOP nav visible:", await ev('(() => { const b = document.querySelector(".bottomNav"); return b ? getComputedStyle(b).display : "none-el"; })()'));
console.log("SHOP panel bg:", await ev('(() => { const el = document.querySelector(".shopsPanel"); return el ? getComputedStyle(el).backgroundImage.slice(0,80) + " | " + getComputedStyle(el).backgroundColor : null; })()'));
console.log("SHOP hero rect:", await ev(rect(".shopStoreHero")));
console.log("SHOP hero radius:", await ev('(() => { const el = document.querySelector(".shopStoreHero"); return el ? getComputedStyle(el).borderRadius : null; })()'));
console.log("SHOP identity rect:", await ev(rect(".shopStoreIdentityCard")));
console.log("SHOP logo rect:", await ev(rect(".shopStoreLogo")));
await snap("shop-storefront-current");
console.log("ERRORS:", JSON.stringify(errors));
ws.close();
