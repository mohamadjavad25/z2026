
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page" && t.url !== "about:blank");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++idc; pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 25000);
});
console.error("navigating...");
await send("Page.navigate", { url: "http://localhost:3000/" });
await new Promise((r) => setTimeout(r, 20000));
console.error("waiting done, evaluating...");
const r = await send("Runtime.evaluate", { expression: "({ app: !!document.querySelector('.appShell'), title: document.title })", returnByValue: true });
console.error("evaluate ->", r.timeout ? "TIMEOUT" : JSON.stringify(r.result?.result?.value));
ws.close();
console.error("DONE");
