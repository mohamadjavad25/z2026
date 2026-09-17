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

console.log("MODAL:", await ev('(() => !!document.querySelector(".explorePreviewModal"))()'));
console.log("HEADER:", await ev('(() => { const h = document.querySelector(".explorePreviewArtistHeader"); if (!h) return null; const av = h.querySelector(".exploreArtistAvatar"); const rate = h.querySelector(".exploreArtistRating"); const meta = h.querySelector(".exploreArtistMeta"); const cs = getComputedStyle(h); return { avatar: av ? Math.round(av.getBoundingClientRect().width) + "px" : null, name: meta ? meta.querySelector("b").innerText : null, sub: meta ? meta.querySelector("small").innerText : null, rating: rate ? rate.innerText.trim() : null, chevron: !!h.querySelector(".exploreArtistChevron"), role: h.getAttribute("role"), aria: h.getAttribute("aria-label"), borderBottom: cs.borderBottomWidth + " " + cs.borderBottomStyle }; })()'));
console.log("NO_OLD_UI:", await ev('(() => { const m = document.querySelector(".explorePreviewModal"); return { profileBtn: !!m.querySelector(".explorePreviewProfile"), artistBlock: !!m.querySelector(".exploreArtistBlock"), heroClose: !!m.querySelector(".explorePreviewHero .artistWorkClose") }; })()'));
console.log("STATS_TRANSPARENT:", await ev('(() => { const s = document.querySelector(".explorePreviewStats"); const cs = getComputedStyle(s); return { border: cs.borderTopStyle, bg: cs.backgroundColor, radius: cs.borderRadius }; })()'));
console.log("CLOSE_GEOM:", await ev('(() => { const m = document.querySelector(".explorePreviewModal"); const sheet = m.querySelector(".explorePreviewSheet"); const close = m.querySelector(".artistWorkClose"); const sr = sheet.getBoundingClientRect(); const cr = close.getBoundingClientRect(); const cs = getComputedStyle(close); return { sheetBottom: Math.round(sr.bottom), closeTop: Math.round(cr.top), closeW: Math.round(cr.width), radius: cs.borderRadius, below: cr.top >= sr.bottom - 2, centered: Math.abs((cr.left + cr.width / 2) - (sr.left + sr.width / 2)) < 4 }; })()'));
console.log("COMMENTS:", await ev('(() => { const m = document.querySelector(".explorePreviewModal"); const sec = m.querySelector(".explorePreviewComments"); if (!sec) return null; const items = [...sec.querySelectorAll(".explorePreviewComment")].map(c => ({ name: c.querySelector(".explorePreviewCommentTop b").innerText, stars: c.querySelectorAll(".exploreCleanStar.is-filled").length, text: c.querySelector("p").innerText.trim().slice(0, 40) })); return { heading: sec.querySelector("h4").innerText, count: items.length, items }; })()'));
console.log("SHOT_PREVIEW:", await snap("p57-preview-header-comments"));

// header click should open artist profile
await ev('(() => { const h = document.querySelector(".explorePreviewArtistHeader"); if (h) h.click(); return !!h; })()');
await sleep(2200);
console.log("PROFILE_OPEN:", await ev('(() => !!document.querySelector(".artistPublicPage"))()'));
console.log("PREVIEW_CLOSED:", await ev('(() => !document.querySelector(".explorePreviewModal"))()'));
console.log("SHOT_PROFILE:", await snap("p58-after-header-click"));
console.log("ERRORS:", JSON.stringify(errors));
ws.close();
console.log("DONE");
