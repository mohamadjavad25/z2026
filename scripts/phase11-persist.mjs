
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
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 140));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(phone, password) { await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)'); await sleep(400); await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(800); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(9000); for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); } await ev("document.documentElement.style.scrollBehavior='auto'"); }
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); }
const out = {};
await send("Runtime.enable"); await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// STEP 1: shop owner saves story (data URL now)
await login("09124445566", "password123");
await load();
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
await ev('(() => { const b = document.querySelector(".shopRefLogoWrap .salonHeroStoryCreateIcon"); if (b) b.click(); return !!b; })()');
await sleep(1500);
const doc = await send("DOM.getDocument", { depth: -1 });
const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: ".salonStoryCreatorUploads input[accept='video/*']" });
if (q.result?.nodeId) await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: ["C:\\Users\\novin\\Desktop\\zibaban\\shots\\phase3\\test-story.mp4"] });
await sleep(6000);
out.preview = await ev('(() => document.querySelector(".salonStoryCreatorPreview")?.classList.contains("has-video") || false)()', 2);
// verify preview is a data URL (not blob)
out.previewIsDataUrl = await ev('(() => { const v = document.querySelector(".salonStoryCreatorPreview video"); return v ? (v.getAttribute("src") || "").startsWith("data:") : null; })()', 2);
await ev('(() => { const b = document.querySelector(".salonStoryPublishButton"); if (b) b.click(); return !!b; })()');
await sleep(2000);
out.toast = await ev('(() => document.querySelector(".appToast span")?.innerText || null)()', 2);
await snap("p11-save");

// STEP 2: logout → login as client → open storefront → story from DB
await login("09121112233", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()');
await sleep(2000);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()');
await sleep(2500);
out.clientSeesVideo = await ev('(() => { const v = document.querySelector(".shopStoreHero video"); return v ? (v.getAttribute("src") || "").slice(0, 24) : "no-video"; })()', 2);
await ev('(() => document.querySelector(".shopStoreLogo")?.click())()');
await sleep(800);
out.clientStoryOpen = await ev('(() => document.querySelector(".shopStorefront")?.classList.contains("is-story-open") || false)()', 2);
await snap("p11-client-sees-story");

// STEP 3: reload (no logout) — still from DB via API
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()');
await sleep(2000);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()');
await sleep(2500);
out.afterReload = await ev('(() => { const v = document.querySelector(".shopStoreHero video"); return v ? "has-video" : "no-video"; })()', 2);

out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
console.error("DONE-MARKER");
