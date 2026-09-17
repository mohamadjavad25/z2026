
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
if (!page) { console.log("NO_PAGE"); process.exit(1); }
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
await ev('(() => { const b = [...document.querySelectorAll(".explorePreviewModal button")].find(x => /پروفایل/.test((x.innerText || "") + (x.getAttribute("aria-label") || ""))); if (b) b.click(); return !!b; })()');
await sleep(2500);
await ev('(() => { const s = document.querySelector(".artistPublicSheet"); const r = document.querySelector(".artistPublicReviews"); if (s) s.scrollTop = s.scrollHeight; if (r) r.scrollIntoView({ block: "center" }); return !!r; })()');
await sleep(1200);
console.log("PLACEHOLDER-TEXT:", await ev('(() => [...document.querySelectorAll(".artistPublicReviews p")].filter(p => (p.innerText || "").includes("امتیاز ثبت")).length)()'));
console.log("P-COUNT-IN-CARDS:", await ev('(() => document.querySelectorAll(".artistPublicReviewCard p").length)()'));
console.log("CARDS:", await ev('(() => document.querySelectorAll(".artistPublicReviewCard").length)()'));
console.log("FIRSTCARD-TEXT:", await ev('(() => { const c = document.querySelector(".artistPublicReviewCard"); return c ? c.innerText.split(String.fromCharCode(10)).join(" | ") : null; })()'));
console.log("SECTIONH:", await ev('(() => Math.round(document.querySelector(".artistPublicReviews").getBoundingClientRect().height))()'));
console.log("SHOT:", await snap("p49-reviews-no-placeholder"));
console.log("ERRORS:", JSON.stringify(errors));
ws.close();
console.log("DONE");
