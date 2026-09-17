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
  if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.type + ": " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(phone, password) { await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)'); await sleep(400); await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(800); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(9000); for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); } await ev("document.documentElement.style.scrollBehavior='auto'"); }
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09122223344", "password123");
await load();
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
logs.length = 0;
await ev('(() => { const w = document.querySelector(".profileStoryAvatarWrap"); if (w) w.click(); return !!w; })()');
await sleep(700);
console.error("OPEN-LOGS:", JSON.stringify(logs.filter(l => l.includes("RENDER-DEBUG") || l.includes("STATE-DEBUG"))));
logs.length = 0;
// close with X (known working)
await ev('(() => { const b = document.querySelector(".salonStoryCreatorClose"); if (b) b.click(); return !!b; })()');
await sleep(700);
console.error("X-CLOSE-LOGS:", JSON.stringify(logs.filter(l => l.includes("RENDER-DEBUG") || l.includes("STATE-DEBUG"))));
console.error("CLOSED:", await ev('(() => !document.querySelector(".salonStoryCreatorOverlay"))()'));
logs.length = 0;
// reopen
await ev('(() => { const w = document.querySelector(".profileStoryAvatarWrap"); if (w) w.click(); return !!w; })()');
await sleep(700);
console.error("REOPEN-LOGS:", JSON.stringify(logs.filter(l => l.includes("RENDER-DEBUG") || l.includes("STATE-DEBUG"))));
console.error("OPEN:", await ev('(() => !!document.querySelector(".salonStoryCreatorOverlay"))()'));
ws.close();
console.error("DONE");