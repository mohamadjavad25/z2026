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
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 130));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 20000); });
const ev = async (expression, retries = 2) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 4000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)');
await sleep(400);
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09121112233", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(800);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(10000);
for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); }
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()');
await sleep(2000);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()');
let captured = false;
for (let i = 0; i < 50; i++) {
  const r = await ev('(() => { const s = document.querySelector(".shopStoreCatalogSkeleton"); if (!s) return null; const card = s.closest(".shopStoreCard"); const cr = card?.getBoundingClientRect(); const sr = s.getBoundingClientRect(); const cs = getComputedStyle(s); const items = s.querySelectorAll(".uxSkeletonItem"); return { cardW: cr ? Math.round(cr.width) : null, skW: Math.round(sr.width), grid: cs.gridTemplateColumns, itemW: items[0] ? Math.round(items[0].getBoundingClientRect().width) : null }; })()');
  if (r && r !== "TIMEOUT" && r.skW > 200) { out.settle = r; captured = true; break; }
  await sleep(50);
}
if (!captured) {
  // capture whatever exists after a short wait
  await sleep(400);
  out.late = await ev('(() => { const s = document.querySelector(".shopStoreCatalogSkeleton"); if (!s) return null; const card = s.closest(".shopStoreCard"); const cr = card?.getBoundingClientRect(); const cs = getComputedStyle(s); const items = s.querySelectorAll(".uxSkeletonItem"); return { cardW: cr ? Math.round(cr.width) : null, grid: cs.gridTemplateColumns, itemW: items[0] ? Math.round(items[0].getBoundingClientRect().width) : null, products: document.querySelectorAll(".shopStoreProduct").length }; })()');
}
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
console.error("DONE-MARKER");