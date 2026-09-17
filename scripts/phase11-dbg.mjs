
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
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) logs.push(m.params.type + ": " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 250));
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 250));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 150); return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(phone, password) { await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)'); await sleep(400); await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(800); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(9000); for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); } await ev("document.documentElement.style.scrollBehavior='auto'"); }
await send("Runtime.enable"); await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09124445566", "password123");
await load();
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
console.error("BTN:", await ev('(() => !!document.querySelector(".shopRefLogoWrap .salonHeroStoryCreateIcon"))()'));
await ev('(() => { const b = document.querySelector(".shopRefLogoWrap .salonHeroStoryCreateIcon"); if (b) b.click(); return !!b; })()');
await sleep(1500);
console.error("OVERLAY:", await ev('(() => !!document.querySelector(".salonStoryCreatorOverlay"))()'));
console.error("INPUTS:", await ev('(() => [...document.querySelectorAll(".salonStoryCreatorUploads input")].map(i => i.accept))()'));
const doc = await send("DOM.getDocument", { depth: -1 });
const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: ".salonStoryCreatorUploads input[accept='video/*']" });
console.error("NODE:", q.result?.nodeId ? "ok" : "missing");
if (q.result?.nodeId) {
  await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: ["C:\\Users\\novin\\Desktop\\zibaban\\shots\\phase3\\test-story.mp4"] });
  console.error("SET-SENT");
}
for (let i = 1; i <= 5; i++) {
  await sleep(4000);
  const st = await ev('(() => { const p = document.querySelector(".salonStoryCreatorPreview"); const v = p?.querySelector("video"); return { has: p?.classList.contains("has-video") || false, src: v ? (v.getAttribute("src") || "").slice(0, 30) : null, sheet: !!document.querySelector(".salonStoryCreatorSheet") }; })()');
  console.error("CHECK-" + i + ":", JSON.stringify(st));
  if (st && st.has) break;
}
console.error("LOGS:", JSON.stringify(logs));
ws.close();
console.error("DONE");
