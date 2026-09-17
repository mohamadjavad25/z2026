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
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 2500)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snap = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); return !!s.result?.data; };
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09121112233", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(600);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(8000);
for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); }
await ev("document.documentElement.style.scrollBehavior='auto'");
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()');
await sleep(2200);
for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.shopCards .shopCard'))()") === true) break; await sleep(1500); }
console.log("SHOP_CARDS:", await ev('(() => document.querySelectorAll(".shopCards .shopCard").length)()'));
await ev('(() => { const c = document.querySelector(".shopCards .shopCard"); if (c) c.click(); return !!c; })()');
await sleep(2500);

console.log("STOREFRONT:", await ev('(() => !!document.querySelector(".shopStorefront"))()'));
console.log("CHIP:", await ev('(() => { const c = document.querySelector(".shopStoreChip"); if (!c) return null; const rating = c.querySelector(".shopStoreChipRating"); const stats = [...c.querySelectorAll(".shopStoreChipStats span")].map(s => s.innerText.trim()); const rcs = getComputedStyle(rating); const cs = getComputedStyle(c); return { ratingText: rating ? rating.innerText.trim() : null, ratingBg: rcs.backgroundColor, ratingColor: rcs.color, stats, chipRadius: cs.borderRadius, chipBorder: cs.borderTopStyle }; })()'));
console.log("FOLLOW:", await ev('(() => { const f = document.querySelector(".shopStoreActions .shopStoreFollow"); if (!f) return null; const cs = getComputedStyle(f); const r = f.getBoundingClientRect(); return { text: f.innerText.trim(), bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius, h: Math.round(r.height), heart: !!f.querySelector("svg"), shadow: cs.boxShadow === "none" ? "none" : "has" }; })()'));
console.log("OLD_GONE:", await ev('(() => { const m = document.querySelector(".shopStorefront"); return { ratingCard: !!m.querySelector(".shopStoreRatingCard"), followers: !!m.querySelector(".shopStoreFollowers") }; })()'));
console.log("SHOT1:", await snap("p62-shop-chip"));

// toggle follow and back to restore state
const initial = await ev('(() => document.querySelector(".shopStoreActions .shopStoreFollow")?.innerText.trim())()');
await ev('(() => { const f = document.querySelector(".shopStoreActions .shopStoreFollow"); if (f) f.click(); return !!f; })()');
await sleep(1400);
console.log("AFTER_TOGGLE:", await ev('(() => { const f = document.querySelector(".shopStoreActions .shopStoreFollow"); return { text: f.innerText.trim(), cls: f.className, bg: getComputedStyle(f).backgroundColor }; })()'));
await ev('(() => { const f = document.querySelector(".shopStoreActions .shopStoreFollow"); if (f) f.click(); return !!f; })()');
await sleep(1400);
console.log("REVERTED:", await ev('(() => document.querySelector(".shopStoreActions .shopStoreFollow")?.innerText.trim())()'), "initial:", initial);
console.log("ERRORS:", JSON.stringify(errors));
ws.close();
console.log("DONE");
