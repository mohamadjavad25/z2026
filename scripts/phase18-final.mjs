const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 200));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 25000); });
const ev = async (expression, retries = 3) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 5000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(15000);
let st = null;
for (let k = 0; k < 6; k++) {
  const r = await ev("(() => ({ app: !!document.querySelector('.appShell'), boot: !!document.querySelector('.authBootScreen'), body: document.body.innerText.slice(0, 40) }))()");
  if (r !== "TIMEOUT") { st = r; break; }
  await sleep(5000);
}
console.log(JSON.stringify({ state: st, errors: errors.slice(0, 4) }, null, 1));
ws.close();
console.error("DONE-MARKER");