
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09121112233", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(600);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(7000);
await ev("document.documentElement.style.scrollBehavior='auto'");
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("اکسپلور")); if (b) b.click(); return !!b; })()');
await sleep(1500);
const cards = await ev('(() => [...document.querySelectorAll(".feedCard")].map(c => ({ txt: (c.innerText || "").trim().slice(0, 50), cls: c.className.slice(0, 60) })))()');
console.log(JSON.stringify(cards, null, 1));
// click each card until artist modal opens
for (let i = 0; i < cards.length; i++) {
  await ev('(() => { const el = document.querySelectorAll(".feedCard")[' + i + ']; if (el) el.click(); return !!el; })()');
  await sleep(1800);
  const open = await ev('(() => !!document.querySelector(".artistPublicPage"))()');
  console.log("card", i, "→ artist modal:", open);
  if (open) {
    await ev('(() => { const b = document.querySelector(".artistPublicBack"); if (b) b.click(); return !!b; })()');
    await sleep(1200);
  }
}
ws.close();
