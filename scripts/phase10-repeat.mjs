
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
let errs = 0;
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error" && (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").includes("static flag")) errs++;
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(phone, password) { await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)'); await sleep(400); await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(700); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(9000); for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); } await ev("document.documentElement.style.scrollBehavior='auto'"); }
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();
const results = [];
for (let i = 0; i < 4; i++) {
  errs = 0;
  await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("سالن")); if (b) b.click(); return !!b; })()'); await sleep(1800);
  await ev('(() => { const el = document.querySelector(".salonRow"); if (el) el.click(); return !!el; })()'); await sleep(2200);
  await ev('(() => document.querySelector(".salonPublicLogoSlot")?.click())()'); await sleep(600);
  const empty = await ev('(() => document.querySelector(".salonPublicProfile")?.classList.contains("is-story-empty") || false)()');
  results.push({ i, empty, errs });
  // back to salons list for next round
  await ev('(() => { const b = document.querySelector(".salonPublicBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1200);
}
console.error("RESULTS:", JSON.stringify(results));
ws.close();
console.error("DONE");
