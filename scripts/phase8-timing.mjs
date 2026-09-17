
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
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC: " + (m.params.exceptionDetails?.exception?.stack || "").slice(0, 400));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("ERR: " + (m.params.args || []).map(a => a.description ?? a.value ?? "").join(" ").slice(0, 300));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 10000); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.timeout) return "TIMEOUT"; if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(phone, password) { await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)'); await send("Network.clearBrowserCookies"); await sleep(400); await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(700); }
await send("Runtime.enable"); await send("DOM.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09124445566", "password123");
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(10000);
for (let i = 0; i < 3; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); }
await ev("document.documentElement.style.scrollBehavior='auto'");
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()');
await sleep(2500);
const clickRes = await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); if (!b) return "no-btn"; b.click(); return "clicked"; })()');
console.error("click:", clickRes);
await sleep(1200);
console.error("overlay:", await ev('(() => !!document.querySelector(".salonStoryCreatorOverlay"))()'));
const doc = await send("DOM.getDocument", { depth: -1 });
const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: ".salonStoryCreatorUploads input[accept='video/*']" });
console.error("node:", q.result?.nodeId ? "ok" : "missing");
await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: ["C:\\Users\\novin\\Desktop\\zibaban\\shots\\phase3\\test-story.mp4"] });
console.error("setFile sent at", Date.now() % 100000);
for (let i = 1; i <= 5; i++) {
  await sleep(6000);
  const r = await ev("({ t: document.title, preview: !!document.querySelector('.salonStoryCreatorPreview.has-video'), sheet: !!document.querySelector('.salonStoryCreatorSheet') })");
  console.error("check-" + i + " (" + (Date.now() % 100000) + "):", r);
  if (r !== "TIMEOUT") break;
}
console.error("LOGS:", JSON.stringify(logs));
ws.close();
console.error("DONE");
