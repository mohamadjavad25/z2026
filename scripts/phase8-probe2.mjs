
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
console.error("tabs:" + list.length);
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
console.error("ws-open");
let idc = 0; const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC: " + (m.params.exceptionDetails?.exception?.stack || "").slice(0, 600));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("ERR: " + (m.params.args || []).map(a => a.description ?? a.value ?? "").join(" ").slice(0, 400));
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++idc; pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 20000);
});
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.timeout) return "TIMEOUT"; if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
console.error("login...");
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09124445566", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(600);
console.error("navigate...");
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(15000);
console.error("loaded, tap profile...");
const t = await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()');
console.error("tap:", t);
await sleep(2500);
console.error("btn:", await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); return b ? "found" : "missing"; })()'));
console.error("clicking...");
const c = await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); if (!b) return "no-btn"; b.click(); return "clicked"; })()');
console.error("click result:", c);
await sleep(2000);
console.error("overlay:", await ev('(() => !!document.querySelector(".salonStoryCreatorOverlay"))()'));
console.error("sheet:", await ev('(() => { const s = document.querySelector(".salonStoryCreatorSheet"); return s ? s.innerText.slice(0, 50) : null; })()'));
console.error("LOGS:", JSON.stringify(logs));
ws.close();
console.error("DONE");
