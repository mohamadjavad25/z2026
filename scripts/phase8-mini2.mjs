
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
console.error("tabs: " + list.map(t => t.type + ":" + t.url.slice(0, 30)).join(" | "));
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
console.error("ws-open");
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++idc; pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 8000);
});
const r1 = await send("Runtime.enable");
console.error("runtime.enable ->", r1.timeout ? "TIMEOUT" : "ok");
const r2 = await send("Runtime.evaluate", { expression: "1+1", returnByValue: true });
console.error("evaluate ->", r2.timeout ? "TIMEOUT" : JSON.stringify(r2.result?.result?.value));
// try Page.navigate to force reload
const r3 = await send("Page.navigate", { url: "http://localhost:3000/" });
console.error("navigate ->", r3.timeout ? "TIMEOUT" : "ok");
const r4 = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true });
console.error("title ->", r4.timeout ? "TIMEOUT" : JSON.stringify(r4.result?.result?.value));
ws.close();
console.error("DONE");
