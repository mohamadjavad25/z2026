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
console.log("STATS_ICON_ONLY:", await ev('(() => { const m = document.querySelector(".explorePreviewModal"); if (!m) return null; const box = m.querySelector(".explorePreviewStats"); const btns = box ? [...box.querySelectorAll(".exploreStatBtn")] : []; const labels = m.querySelectorAll(".exploreStatLabel").length; const aria = btns.map(b => b.getAttribute("aria-label")); const icons = box ? box.querySelectorAll(".exploreStatIcon").length : 0; const cs = btns[0] ? getComputedStyle(btns[0]) : null; const ics = box.querySelector(".exploreStatIcon") ? getComputedStyle(box.querySelector(".exploreStatIcon")) : null; return { labels, btns: btns.length, aria, icons, btnMinH: cs ? cs.minHeight : null, iconSize: ics ? Math.round(box.querySelector(".exploreStatIcon").getBoundingClientRect().width) : 0 }; })()'));

await ev('(() => { const b = document.querySelector(".explorePreviewModal .exploreStatRate"); if (b) b.click(); return !!b; })()');
await sleep(900);
console.log("RATING_OPEN:", await ev('(() => !!document.querySelector(".exploreRatingModal"))()'));
console.log("RATING_PROBE:", await ev('(() => { const m = document.querySelector(".exploreRatingModal"); if (!m) return null; const sheet = m.querySelector(".exploreRatingSheet"); const close = m.querySelector(".exploreRatingClose"); const ccs = close ? getComputedStyle(close) : null; const stars = m.querySelectorAll(".exploreRatingStarBtn"); const clean = m.querySelectorAll(".exploreRatingCleanStar"); const marble = m.querySelectorAll(".marbleRatingStar"); const ta = m.querySelector(".exploreRatingComment textarea"); const submit = m.querySelector(".exploreRatingSubmit"); const scs = submit ? getComputedStyle(submit) : null; const on = [...stars].filter(s => s.classList.contains("is-on")).length; return { close: close ? { w: Math.round(close.getBoundingClientRect().width), radius: ccs.borderRadius } : null, starBtns: stars.length, cleanStars: clean.length, marble: marble.length, onCount: on, hint: (m.querySelector(".exploreRatingHint") || {}).innerText, hasTextarea: !!ta, placeholder: ta ? ta.getAttribute("placeholder") : null, submit: submit ? { text: submit.innerText.trim(), disabled: submit.disabled, bg: scs.backgroundColor, radius: scs.borderRadius } : null, sheetRadius: getComputedStyle(sheet).borderRadius }; })()'));

console.log("SHOT_RATING:", await snap("p54-rating-modal"));

// select 5 stars, write a comment, submit
await ev('(() => { const b = [...document.querySelectorAll(".exploreRatingStarBtn")].find(x => x.getAttribute("aria-label") === "5 ستاره"); if (b) b.click(); return !!b; })()');
await sleep(300);
await ev('(() => { const ta = document.querySelector(".exploreRatingComment textarea"); if (ta) { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; setter.call(ta, "خیلی تمیز و مرتب بود، ممنون!"); ta.dispatchEvent(new Event("input", { bubbles: true })); } return !!ta; })()');
await sleep(400);
console.log("SUBMIT_STATE:", await ev('(() => { const s = document.querySelector(".exploreRatingSubmit"); return s ? { text: s.innerText.trim(), disabled: s.disabled, count: (document.querySelector(".exploreRatingCount")||{}).innerText } : null; })()'));
console.log("SHOT_FILLED:", await snap("p55-rating-filled"));
await ev('(() => { const s = document.querySelector(".exploreRatingSubmit"); if (s) s.click(); return !!s; })()');
await sleep(1600);
console.log("RATING_CLOSED:", await ev('(() => !document.querySelector(".exploreRatingModal"))()'));
console.log("NOTIFY:", await ev('(() => { const el = document.querySelector("[class*=toast], [class*=notify]"); return el ? el.innerText.trim().slice(0, 80) : null; })()'));
console.log("PREVIEW_RATE_LABEL:", await ev('(() => { const b = document.querySelector(".explorePreviewModal .exploreStatRate"); return b ? { active: b.classList.contains("is-active"), aria: b.getAttribute("aria-label") } : null; })()'));
console.log("SHOT_AFTER:", await snap("p56-after-rate"));
console.log("ERRORS:", JSON.stringify(errors));
ws.close();
console.log("DONE");
