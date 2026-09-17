
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
let errs = 0; const kinds = {};
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    const t = (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 60);
    errs++; kinds[t] = (kinds[t] || 0) + 1;
  }
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 10000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09121112233", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(800);
const results = [];
for (let run = 0; run < 3; run++) {
  errs = 0;
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(10000);
  for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); }
  await sleep(1500);
  results.push({ run, errs, kinds: { ...kinds } });
  for (const k of Object.keys(kinds)) delete kinds[k];
}
console.error("RESULTS:", JSON.stringify(results));
ws.close();
console.error("DONE");
