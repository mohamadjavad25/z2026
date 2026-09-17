
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
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 180); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); }
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09121112233", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(600);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(7000);
await ev("document.documentElement.style.scrollBehavior='auto'");
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("اکسپلور")); if (b) b.click(); return !!b; })()');
await sleep(1500);
await ev('(() => { const el = document.querySelector(".feedCard"); if (el) el.click(); return !!el; })()');
await sleep(1800);
const previewOpen = await ev('(() => !!document.querySelector(".explorePreviewModal"))()');
console.log("preview open:", previewOpen);
// find the artist profile button in preview
const btns = await ev('(() => [...document.querySelectorAll(".explorePreviewModal button")].map(b => ({ t: (b.innerText || b.getAttribute("aria-label") || "").trim().slice(0, 30) })))()');
console.log("preview buttons:", JSON.stringify(btns));
await ev('(() => { const b = [...document.querySelectorAll(".explorePreviewModal button")].find(x => /پروفایل/.test((x.innerText || "") + (x.getAttribute("aria-label") || ""))); if (b) b.click(); return !!b; })()');
await sleep(2200);
const artistOpen = await ev('(() => !!document.querySelector(".artistPublicPage"))()');
console.log("artist open:", artistOpen);
if (artistOpen) {
  const avatar = await ev('(() => { const a = document.querySelector(".artistPublicAvatar"); return a ? { cls: a.className.slice(0, 100), role: a.getAttribute("role") } : null; })()');
  console.log("avatar:", JSON.stringify(avatar));
  await ev('(() => document.querySelector(".artistPublicAvatar")?.click())()');
  await sleep(500);
  const story = await ev('(() => { const p = document.querySelector(".artistPublicPage"); return { empty: p?.classList.contains("is-story-empty"), rail: getComputedStyle(document.querySelector(".publicStoryRail")).opacity }; })()');
  console.log("artist story:", JSON.stringify(story));
  await snap("p8-artist-story");
}
console.log("errors:", JSON.stringify(errors));
ws.close();
