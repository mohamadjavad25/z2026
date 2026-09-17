import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find(function (t) { return t.type === "page"; });
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(function (res, rej) { ws.onopen = res; ws.onerror = rej; });
let idc = 0;
const pending = new Map();
ws.onmessage = function (ev) { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = function (method, params) { return new Promise(function (resolve) { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id: id, method: method, params: params || {} })); setTimeout(function () { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); }); };
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Runtime.evaluate", { expression: "fetch(\"/api/auth/login\", { method: \"POST\", headers: { \"Content-Type\": \"application/json\" }, body: JSON.stringify({ phone: \"09121112233\", password: \"password123\" }) }).then(function (r) { location.href = \"/\"; return r.status; }).catch(function (e) { return String(e); });", returnByValue: true });
await sleep(4000);
const tabs = ["اکسپلور", "سالن", "فروشگاه", "پروفایل", "چت"];
for (const t of tabs) {
  await send("Runtime.evaluate", { expression: "var b = document.querySelectorAll(\".bottomNav button\"); for (var i = 0; i < b.length; i++) { if (b[i].textContent.indexOf(\"" + t + "\") !== -1) { b[i].click(); break; } }", returnByValue: true });
  await sleep(900);
  const s = await send("Page.captureScreenshot", { format: "png" });
  const name = t === "اکسپلور" ? "p64-feed" : t === "سالن" ? "p65-salons" : t === "فروشگاه" ? "p66-shops" : t === "پروفایل" ? "p67-profile" : "p68-chat";
  if (s.result && s.result.data) { writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); console.log("shot " + name); }
}
ws.close();
process.exit(0);