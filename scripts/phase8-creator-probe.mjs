
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page" && t.url !== "about:blank");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC: " + (m.params.exceptionDetails?.exception?.stack || "").slice(0, 700));
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) logs.push(m.params.type.toUpperCase() + ": " + (m.params.args || []).map(a => a.description ?? a.value ?? "").join(" ").slice(0, 500));
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++idc; pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000);
});
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.timeout) return "TIMEOUT"; if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09124445566", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(600);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(15000);
await ev("document.documentElement.style.scrollBehavior='auto'");
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()');
await sleep(2500);
console.error("BTN:", await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); return b ? "found" : "missing"; })()'));
const clickRes = await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); if (!b) return "no-btn"; b.click(); return "clicked"; })()');
console.error("CLICK:", clickRes);
await sleep(1500);
console.error("OVERLAY:", await ev('(() => !!document.querySelector(".salonStoryCreatorOverlay"))()'));
console.error("SHEET:", await ev('(() => { const s = document.querySelector(".salonStoryCreatorSheet"); return s ? (s.innerText || "").slice(0, 60) : null; })()'));
console.error("LOGS:", logs.join("\n") || "(none)");
ws.close();
