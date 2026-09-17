
import { writeFileSync } from "node:fs";
console.error("STEP:A");
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
console.error("STEP:B tabs=" + list.length);
const page = list.find((t) => t.type === "page");
console.error("STEP:C page=" + (page ? page.url : "none"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
console.error("STEP:D ws-open");
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
await send("Runtime.enable");
console.error("STEP:E runtime-enabled");
const evv = async (expression) => { const rr = await send("Runtime.evaluate", { expression, returnByValue: true }); return rr.result?.result?.value; };
console.error("STEP:F val=" + (await evv("1+1")));
ws.close();
console.error("STEP:G done");
