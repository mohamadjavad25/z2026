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
// step 1: login + navigate (fire and forget)
await send("Runtime.evaluate", { expression: "fetch(\"/api/auth/login\", { method: \"POST\", headers: { \"Content-Type\": \"application/json\" }, body: JSON.stringify({ phone: \"09121112233\", password: \"password123\" }) }).then(function (r) { location.href = \"/\"; return r.status; }).catch(function (e) { return String(e); });", returnByValue: true });
await sleep(4000);
// step 2: main probe
const r = await send("Runtime.evaluate", { expression: "async function waitFor(sel, ms) {\n  const t0 = Date.now();\n  while (Date.now() - t0 < ms) {\n    const el = document.querySelector(sel);\n    if (el) return el;\n    await new Promise((res) => setTimeout(res, 150));\n  }\n  throw new Error(\"timeout: \" + sel);\n}\n\nfunction rect(sel) {\n  const el = document.querySelector(sel);\n  if (!el) return null;\n  const r = el.getBoundingClientRect();\n  return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };\n}\n\nasync function main() {\n  await waitFor(\".appShell\", 12000);\n  const tabs = document.querySelectorAll(\".bottomNav button\");\n  for (const t of tabs) {\n    if (t.textContent.includes(\"فروشگاه\")) { t.click(); break; }\n  }\n  await new Promise((res) => setTimeout(res, 600));\n  const card = await waitFor(\".shopCards .shopCard\", 12000);\n  card.click();\n  await waitFor(\".shopStorefront\", 12000);\n  await new Promise((res) => setTimeout(res, 900));\n\n  const out = {};\n  const shopsPanel = document.querySelector(\".shopsPanel\");\n  out.tabActive = shopsPanel ? getComputedStyle(shopsPanel).display !== \"none\" : false;\n  out.appShellIsStore = document.querySelector(\".appShell\").className.includes(\"is-shop-store\");\n  out.shopName = document.querySelector(\".shopStoreTitle h2\") ? document.querySelector(\".shopStoreTitle h2\").textContent.trim() : null;\n  out.titleSpan = document.querySelector(\".shopStoreTitle span\") ? document.querySelector(\".shopStoreTitle span\").textContent.trim() : null;\n  out.titleRect = rect(\".shopStoreTitle\");\n  out.chipRect = rect(\".shopStoreChip\");\n  const chip = document.querySelector(\".shopStoreChip\");\n  out.chipText = chip ? chip.textContent.replace(/\\s+/g, \" \").trim() : null;\n  const rt = document.querySelector(\".shopStoreChipRating\");\n  out.ratingText = rt ? rt.textContent.replace(/\\s+/g, \" \").trim() : null;\n  const st = document.querySelector(\".shopStoreChipStats\");\n  out.statsText = st ? st.textContent.replace(/\\s+/g, \" \").trim() : null;\n  const ct = document.querySelector(\".shopStoreCityTag\");\n  out.cityText = ct ? ct.textContent.replace(/\\s+/g, \" \").trim() : null;\n  out.logoRect = rect(\".shopStoreLogo\");\n  out.cityRect = rect(\".shopStoreCityTag\");\n  const logo = document.querySelector(\".shopStoreLogo\");\n  const cs = getComputedStyle(logo);\n  out.logoBorder = cs.border;\n  out.logoShadow = cs.boxShadow;\n  out.logoRadius = cs.borderRadius;\n  out.logoBg = cs.backgroundImage;\n  const fb = document.querySelector(\".shopStoreActions .shopStoreFollow\");\n  out.followText = fb ? fb.textContent.replace(/\\s+/g, \" \").trim() : null;\n  if (fb) { const fcs = getComputedStyle(fb); out.followBg = fcs.backgroundColor; out.followRadius = fcs.borderRadius; out.followShadow = fcs.boxShadow; }\n  if (out.titleRect && out.chipRect) {\n    out.chipBelowTitle = out.chipRect.top >= out.titleRect.bottom;\n    out.verticalGap = out.chipRect.top - out.titleRect.bottom;\n  }\n  if (out.logoRect && out.cityRect) {\n    const lc = out.logoRect.left + out.logoRect.width / 2;\n    const cc = out.cityRect.left + out.cityRect.width / 2;\n    out.cityBelowLogo = out.cityRect.top >= out.logoRect.bottom && Math.abs(lc - cc) < 20;\n    out.cityGap = out.cityRect.top - out.logoRect.bottom;\n  }\n  const cardEl = document.querySelector(\".shopStoreIdentityCard\");\n  const cardRect = cardEl.getBoundingClientRect();\n  out.logoOverhang = Math.round(cardRect.top - out.logoRect.top);\n  out.cardPaddingTop = getComputedStyle(cardEl).paddingTop;\n  const chain = [];\n  let node = cardEl;\n  while (node && node !== document.body) {\n    const d = getComputedStyle(node).display;\n    const v = getComputedStyle(node).visibility;\n    chain.push(node.className ? String(node.className).split(\" \")[0] + \":\" + d + \"/\" + v : node.tagName + \":\" + d + \"/\" + v);\n    node = node.parentElement;\n  }\n  out.ancestorChain = chain;\n  out.nextOverlay = !!document.querySelector(\"nextjs-portal\");\n  out.shopStorefrontDisplay = document.querySelector(\".shopStorefront\") ? getComputedStyle(document.querySelector(\".shopStorefront\")).display : null;\n  return JSON.stringify(out);\n}\n\nmain().then(function (o) { return o; }, function (e) { return \"PROBE_ERROR \" + e.message; });", returnByValue: true, awaitPromise: true });
if (r.timeout) { console.log("EVAL TIMEOUT"); process.exit(1); }
if (r.error) { console.log("ERR: " + JSON.stringify(r.error)); }
if (r.result && r.result.exceptionDetails) {
  console.log("EXC: " + JSON.stringify(r.result.exceptionDetails));
} else if (r.result) {
  console.log(r.result.result.value);
  const s = await send("Page.captureScreenshot", { format: "png" });
  if (s.result && s.result.data) { writeFileSync("shots/phase3/p63.png", Buffer.from(s.result.data, "base64")); console.log("SHOT saved p63"); }
}
ws.close();
process.exit(0);