
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 8000); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.timeout) return "TIMEOUT"; if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable"); await send("DOM.enable");
// go to a data: URL page with a file input
await send("Page.navigate", { url: "data:text/html,<input type='file' id='f'><script>window.__changed=0;document.getElementById('f').addEventListener('change',()=>{window.__changed++})</script>" });
await sleep(2000);
console.error("page-ok:", await ev("1+1"));
const doc = await send("DOM.getDocument", { depth: -1 });
const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "#f" });
console.error("node:", q.result?.nodeId);
await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: ["C:\\Users\\novin\\Desktop\\zibaban\\shots\\phase3\\test-story.mp4"] });
console.error("set done");
await sleep(1000);
console.error("changed:", await ev("window.__changed"));
console.error("evaluate-ok:", await ev("2+2"));
ws.close();
console.error("DONE");
