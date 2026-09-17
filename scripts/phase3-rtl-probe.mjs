
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; };
await send("Runtime.enable");
const out = await ev('(() => { const el = document.createElement("div"); el.style.cssText = "display:grid; grid-template-columns: 50px 50px 50px; direction: rtl; position: fixed; top: 0; left: 0;"; const a = document.createElement("span"); a.style.cssText = "grid-column: 1; background: red;"; const c = document.createElement("span"); c.style.cssText = "grid-column: 3; background: blue;"; el.append(a, c); document.body.append(el); const ar = a.getBoundingClientRect(); const cr = c.getBoundingClientRect(); el.remove(); return { col1: Math.round(ar.x), col3: Math.round(cr.x) }; })()');
console.log(JSON.stringify(out));
ws.close();
