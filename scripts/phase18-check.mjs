import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
console.error("TABS:", JSON.stringify(list.map(t => ({ type: t.type, url: (t.url || "").slice(0, 60) }))));
const page = list.find((t) => t.type === "page" && t.url !== "about:blank") || list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 250));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 250));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 20000); });
const ev = async (expression, retries = 2) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200); return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 4000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(15000);
for (let i = 0; i < 6; i++) {
  const r = await ev("(() => ({ app: !!document.querySelector('.appShell'), auth: !!document.querySelector('.authBootScreen'), skeleton: !!document.querySelector('.skeleton, [class*=Skeleton], .loadingScreen, .bootScreen'), bodyText: document.body.innerText.slice(0, 80) }))()");
  if (r !== "TIMEOUT" && r !== "EVAL_ERR") { out.state = r; break; }
  await sleep(5000);
}
out.errors = errors.slice(0, 6);
const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/p18-stuck.png", Buffer.from(s.result.data, "base64"));
console.log(JSON.stringify(out, null, 1));
ws.close();
console.error("DONE-MARKER");