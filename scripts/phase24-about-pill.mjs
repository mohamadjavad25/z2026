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
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("اکسپلور")); if (b) b.click(); return !!b; })()');
await sleep(2200);
await ev('(() => { const el = document.querySelector(".feedCard"); if (el) el.click(); return !!el; })()');
await sleep(2200);
await ev('(() => { const h = document.querySelector(".explorePreviewArtistHeader"); if (h) h.click(); return !!h; })()');
await sleep(2500);

console.log("BAR_BG:", await ev('(() => { const bar = document.querySelector(".artistPublicBooking"); const cs = getComputedStyle(bar); return { bg: cs.backgroundColor, borderTop: cs.borderTopWidth + " " + cs.borderTopStyle, boxShadow: cs.boxShadow }; })()'));
console.log("BTN:", await ev('(() => { const b = document.querySelector(".artistPublicAboutBtn"); if (!b) return null; const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius, bg: cs.backgroundColor, color: cs.color, shadow: cs.boxShadow, border: cs.borderTopWidth + " " + cs.borderTopStyle, text: b.innerText.trim(), icon: Math.round(b.querySelector("svg").getBoundingClientRect().width) }; })()'));
await ev('(() => { const b = document.querySelector(".artistPublicAboutBtn"); if (b) b.click(); return !!b; })()');
await sleep(800);
console.log("OPEN:", await ev('(() => !!document.querySelector(".artistAboutPopup"))()'));
console.log("SHOT:", await snap("p60-about-pill-btn"));
await ev('(() => { const c = document.querySelector(".artistAboutPopupClose"); if (c) c.click(); return !!c; })()');
await sleep(400);
console.log("CLOSED:", await ev('(() => !document.querySelector(".artistAboutPopup"))()'));
console.log("ERRORS:", JSON.stringify(errors));
ws.close();
console.log("DONE");
