
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC-STACK: " + (m.params.exceptionDetails?.exception?.stack || m.params.exceptionDetails?.text || "").slice(0, 1500));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("ERR: " + (m.params.args || []).map(a => a.description ?? a.value ?? "").join(" ").slice(0, 600));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 10000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable"); await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)');
await sleep(500);
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09122223344", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(800);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(10000);
for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); }
await ev("document.documentElement.style.scrollBehavior='auto'");
// STEP 1: save story in artist profile
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); if (b) b.click(); return !!b; })()');
await sleep(1500);
const doc = await send("DOM.getDocument", { depth: -1 });
const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: ".salonStoryCreatorUploads input[accept='video/*']" });
if (q.result?.nodeId) await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: ["C:\\Users\\novin\\Desktop\\zibaban\\shots\\phase3\\test-story.mp4"] });
await sleep(6000);
console.error("PREVIEW:", await ev('(() => document.querySelector(".salonStoryCreatorPreview")?.classList.contains("has-video") || false)()', 2));
await ev('(() => { const b = document.querySelector(".salonStoryPublishButton"); if (b) b.click(); return !!b; })()');
await sleep(1500);
console.error("TOAST:", await ev('(() => document.querySelector(".appToast span")?.innerText || null)()', 2));
// STEP 2: same session → explore → self post → profile modal
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("اکسپلور")); if (b) b.click(); return !!b; })()');
await sleep(2500);
await ev('(() => { const el = document.querySelector(".feedCard"); if (el) el.click(); return !!el; })()');
await sleep(2000);
await ev('(() => { const b = [...document.querySelectorAll(".explorePreviewModal button")].find(x => /پروفایل/.test((x.innerText || "") + (x.getAttribute("aria-label") || ""))); if (b) b.click(); return !!b; })()');
await sleep(2500);
console.error("MODAL:", await ev('(() => !!document.querySelector(".artistPublicPage"))()'));
console.error("VIDEO-SRC:", await ev('(() => { const v = document.querySelector(".artistPublicPage video"); return v ? (v.getAttribute("src") || "").slice(0, 30) || "empty" : "no-video"; })()', 2));
await ev('(() => document.querySelector(".artistPublicAvatar")?.click())()');
await sleep(800);
console.error("STORY-OPEN:", await ev('(() => document.querySelector(".artistPublicPage")?.classList.contains("is-story-open") || false)()', 2));
const s1 = await send("Page.captureScreenshot", { format: "png" }); if (s1.result?.data) writeFileSync("shots/phase3/p8-artist-story-play.png", Buffer.from(s1.result.data, "base64"));
console.error("LOGS:", JSON.stringify(logs));
ws.close();
console.error("DONE");
