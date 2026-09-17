import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find(function (t) { return t.type === "page"; });
if (!page) throw new Error("no page tab");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(function (res, rej) { ws.onopen = res; ws.onerror = rej; });
let idc = 0;
const pending = new Map();
ws.onmessage = function (ev) {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = function (method, params) {
  return new Promise(function (resolve) {
    const id = ++idc;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    setTimeout(function () { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 20000);
  });
};
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Runtime.evaluate", { expression: "fetch(\"/api/auth/login\", { method: \"POST\", headers: { \"Content-Type\": \"application/json\" }, body: JSON.stringify({ phone: \"09121112233\", password: \"password123\" }) }).then(function (r) { location.href = \"/\"; return r.status; }).catch(function (e) { return String(e); });", returnByValue: true });
await sleep(4000);
const r = await send("Runtime.evaluate", { expression: "async function waitFor(sel, ms) {\n  const t0 = Date.now();\n  while (Date.now() - t0 < ms) {\n    const el = document.querySelector(sel);\n    if (el) return el;\n    await new Promise((res) => setTimeout(res, 150));\n  }\n  throw new Error(\"timeout: \" + sel);\n}\n\nfunction isWhiteish(c) {\n  if (!c || c === \"transparent\") return true;\n  const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);\n  if (!m) return true;\n  const a = m[4] === undefined ? 1 : parseFloat(m[4]);\n  return a < 0.02 || (m[1] >= 245 && m[2] >= 245 && m[3] >= 248);\n}\n\nfunction scanBigNonWhite() {\n  const vw = window.innerWidth, vh = window.innerHeight;\n  const minArea = vw * vh * 0.1;\n  const out = [];\n  const all = document.querySelectorAll(\"*\");\n  for (const el of all) {\n    const r = el.getBoundingClientRect();\n    if (r.width < 40 || r.height < 40) continue;\n    const area = r.width * r.height;\n    if (area < minArea) continue;\n    const cs = getComputedStyle(el);\n    const bg = cs.backgroundColor;\n    const bgi = cs.backgroundImage;\n    if (isWhiteish(bg) && (bgi === \"none\" || bgi.includes(\"none\"))) continue;\n    out.push({\n      cls: String(el.className).split(\" \").slice(0, 3).join(\".\"),\n      tag: el.tagName,\n      area: Math.round(area / (vw * vh) * 100),\n      bg: bg,\n      bgi: bgi.slice(0, 90),\n    });\n  }\n  out.sort(function (a, b) { return b.area - a.area; });\n  return out.slice(0, 14);\n}\n\nasync function switchTab(label) {\n  const btns = document.querySelectorAll(\".bottomNav button\");\n  for (const b of btns) {\n    if (b.textContent.includes(label)) { b.click(); break; }\n  }\n  await new Promise((res) => setTimeout(res, 700));\n}\n\nasync function main() {\n  await waitFor(\".appShell\", 12000);\n  const out = {};\n  const report = function (key) {\n    const body = getComputedStyle(document.body);\n    const shell = document.querySelector(\".appShell\");\n    out[key] = {\n      body: body.backgroundColor + \" | \" + body.backgroundImage.slice(0, 60),\n      shellBg: shell ? getComputedStyle(shell).backgroundColor : null,\n      big: scanBigNonWhite(),\n    };\n  };\n  report(\"feed\");\n  await switchTab(\"سالن\"); report(\"salons\");\n  await switchTab(\"فروشگاه\"); report(\"shops\");\n  await switchTab(\"پروفایل\"); report(\"profile\");\n  await switchTab(\"چت\"); report(\"chat\");\n  await switchTab(\"اکسپلور\");\n  return JSON.stringify(out);\n}\n\nmain().then(function (o) { return o; }, function (e) { return \"PROBE_ERROR \" + e.message; });", returnByValue: true, awaitPromise: true });
if (r.timeout) { console.log("EVAL TIMEOUT"); process.exit(1); }
if (r.result && r.result.exceptionDetails) { console.log("EXC: " + JSON.stringify(r.result.exceptionDetails)); }
else if (r.result) { console.log(r.result.result.value); }
ws.close();
process.exit(0);