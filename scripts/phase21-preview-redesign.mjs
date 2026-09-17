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
await sleep(2000);

console.log("MODAL:", await ev('(() => !!document.querySelector(".explorePreviewModal"))()'));
console.log("SHEET:", await ev('(() => { const s = document.querySelector(".explorePreviewSheet"); if (!s) return null; const r = s.getBoundingClientRect(); const cs = getComputedStyle(s); return { w: Math.round(r.width), radius: cs.borderRadius, bg: cs.backgroundColor }; })()'));

console.log("CLOSE:", await ev('(() => { const b = document.querySelector(".explorePreviewModal .artistWorkClose"); if (!b) return null; const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); const svg = b.querySelector("svg"); return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius, bg: cs.backgroundColor, icon: svg ? Math.round(svg.getBoundingClientRect().width) : 0, text: b.innerText.trim().length }; })()'));

console.log("STATS:", await ev('(() => { const box = document.querySelector(".explorePreviewStats"); if (!box) return null; const cs = getComputedStyle(box); const btns = box.querySelectorAll(".exploreStatBtn"); const icons = box.querySelectorAll(".exploreStatIcon"); const ics = getComputedStyle(box.querySelector(".exploreStatIcon")); const labels = [...box.querySelectorAll(".exploreStatLabel b")].map(x => x.innerText.trim()); const subs = [...box.querySelectorAll(".exploreStatLabel small")].map(x => x.innerText.trim()); return { radius: cs.borderRadius, bg: cs.backgroundColor, border: cs.borderTopWidth + " " + cs.borderTopStyle, btns: btns.length, icons: icons.length, iconSize: Math.round(box.querySelector(".exploreStatIcon").getBoundingClientRect().width), iconRadius: ics.borderRadius, iconBg: ics.backgroundColor, labels, subs }; })()'));

console.log("STARS:", await ev('(() => { const m = document.querySelector(".explorePreviewModal"); if (!m) return null; const clean = m.querySelectorAll(".exploreCleanStar"); const marble = m.querySelectorAll(".marbleRatingStar"); const filled = m.querySelector(".exploreCleanStar.is-filled"); const fcs = filled ? getComputedStyle(filled) : null; const empty = m.querySelector(".exploreCleanStar.is-empty"); const ecs = empty ? getComputedStyle(empty) : null; return { clean: clean.length, marble: marble.length, filledColor: fcs ? fcs.color : null, emptyColor: ecs ? ecs.color : null }; })()'));

console.log("CAPTION:", await ev('(() => { const p = document.querySelector(".explorePreviewModal .artistWorkPreviewCaption"); if (!p) return "none"; const cs = getComputedStyle(p); const r = p.getBoundingClientRect(); return { text: p.innerText.trim().slice(0, 30), radius: cs.borderRadius, bg: cs.backgroundImage.slice(0, 60), h: Math.round(r.height) }; })()'));

console.log("ARTIST:", await ev('(() => { const block = document.querySelector(".exploreArtistBlock"); if (!block) return null; const cs = getComputedStyle(block); const av = block.querySelector(".exploreArtistAvatar"); const avcs = av ? getComputedStyle(av) : null; const rate = block.querySelector(".exploreArtistRating"); const rcs = rate ? getComputedStyle(rate) : null; const rstar = block.querySelector(".exploreCleanStar"); const prof = block.querySelector(".explorePreviewProfile"); const pcs = prof ? getComputedStyle(prof) : null; return { radius: cs.borderRadius, bg: cs.backgroundImage.slice(0, 80), border: cs.borderTopWidth + " " + cs.borderTopStyle, avatar: av ? Math.round(av.getBoundingClientRect().width) + "px " + avcs.backgroundImage.slice(0, 60) : null, rating: rate ? { radius: rcs.borderRadius, bg: rcs.backgroundColor, color: rcs.color, text: rate.innerText.trim(), star: !!rstar } : null, profile: prof ? { text: prof.innerText.trim(), bg: pcs.backgroundColor, radius: pcs.borderRadius, chevrons: prof.querySelectorAll("svg").length } : null }; })()'));

console.log("SHOT:", await snap("p53-preview-redesign"));
console.log("ERRORS:", JSON.stringify(errors));
ws.close();
console.log("DONE");
