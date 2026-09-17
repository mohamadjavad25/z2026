
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
const dump = (sel) => '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return { miss: true }; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); const svg = el.querySelector("svg"); const svgR = svg ? svg.getBoundingClientRect() : null; const svgCs = svg ? getComputedStyle(svg) : null; return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, bgImg: (cs.backgroundImage || "").slice(0, 40), color: cs.color, border: cs.border, radius: cs.borderRadius, disp: cs.display, op: cs.opacity, vis: cs.visibility, pe: cs.pointerEvents, z: cs.zIndex, svg: svgR ? { x: Math.round(svgR.x), y: Math.round(svgR.y), w: Math.round(svgR.width), h: Math.round(svgR.height), fill: svgCs.fill, color: svgCs.color } : null, txt: (el.innerText || "").trim().slice(0, 30) }; })()';
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(600); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(6500); await ev("document.documentElement.style.scrollBehavior='auto'"); }
async function openShop(name) { return ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()').then(() => sleep(1100)).then(() => ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes(' + JSON.stringify(name) + ')); if (el) el.click(); return !!el; })()')).then(() => sleep(2300)); }

// DESKTOP
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();
await openShop("loiih");
console.log("D-DOCK:", await ev(dump(".shopStoreDock")));
console.log("D-CART:", await ev(dump(".shopStoreDockCart")));
console.log("D-CHAT:", await ev(dump(".shopStoreDockChat")));
console.log("D-ICON:", await ev(dump(".shopStoreDockIcon")));
const s1 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("shots/phase2/dock-before-desktop.png", Buffer.from(s1.result.data, "base64"));

// MOBILE
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await load();
await openShop("loiih");
console.log("M-DOCK:", await ev(dump(".shopStoreDock")));
console.log("M-CART:", await ev(dump(".shopStoreDockCart")));
console.log("M-CHAT:", await ev(dump(".shopStoreDockChat")));
console.log("M-ICON:", await ev(dump(".shopStoreDockIcon")));
const s2 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("shots/phase2/dock-before-mobile.png", Buffer.from(s2.result.data, "base64"));
ws.close();
