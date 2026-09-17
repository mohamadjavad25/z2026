const http = require("node:http");
const fs = require("node:fs");

async function getWs() {
  const res = await fetch("http://127.0.0.1:9333/json/list");
  const tabs = await res.json();
  const page = tabs.find(function (t) { return t.type === "page"; });
  if (!page) throw new Error("no page tab");
  return page.webSocketDebuggerUrl;
}

const WS_URL = await getWs();

function connect(wsUrl) {
  return new Promise(function (resolve, reject) {
    const url = new URL(wsUrl);
    const key = Buffer.from(Math.random().toString()).toString("base64");
    const req = http.request({
      host: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": key
      }
    });
    req.on("upgrade", function (res, socket) { resolve(socket); });
    req.on("error", reject);
    req.end();
  });
}

const socket = await connect(WS_URL);
let msgId = 0;
const pending = new Map();
let buffer = Buffer.alloc(0);

function send(method, params) {
  return new Promise(function (resolve, reject) {
    const id = ++msgId;
    pending.set(id, { resolve: resolve, reject: reject });
    socket.write(JSON.stringify({ id: id, method: method, params: params || {} }) + "\n");
  });
}

socket.on("data", function (chunk) {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const idx = buffer.indexOf(0x0a);
    if (idx === -1) break;
    const line = buffer.slice(0, idx).toString();
    buffer = buffer.slice(idx + 1);
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    } catch (e) {}
  }
});

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

const evt = await send("Runtime.evaluate", { expression: "async function loginAndGo() {\n  const r = await fetch(\"/api/auth/login\", {\n    method: \"POST\",\n    headers: { \"Content-Type\": \"application/json\" },\n    body: JSON.stringify({ phone: \"09121112233\", password: \"password123\" }),\n  });\n  if (!r.ok) throw new Error(\"login failed \" + r.status);\n  location.href = \"/\";\n}\n\nasync function waitFor(sel, ms) {\n  const t0 = Date.now();\n  while (Date.now() - t0 < ms) {\n    const el = document.querySelector(sel);\n    if (el) return el;\n    await new Promise((res) => setTimeout(res, 150));\n  }\n  throw new Error(\"timeout: \" + sel);\n}\n\nfunction rect(sel) {\n  const el = document.querySelector(sel);\n  if (!el) return null;\n  const r = el.getBoundingClientRect();\n  return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };\n}\n\nasync function main() {\n  await loginAndGo();\n  await waitFor(\".appShell\", 12000);\n  const tabs = document.querySelectorAll(\".bottomNavTab\");\n  for (const t of tabs) {\n    if (t.textContent.includes(\"فروشگاه\")) { t.click(); break; }\n  }\n  const card = await waitFor(\".shopCards .shopCard\", 12000);\n  card.click();\n  await waitFor(\".shopStorefront\", 12000);\n  await new Promise((res) => setTimeout(res, 800));\n\n  const out = {};\n  out.shopName = document.querySelector(\".shopStoreTitle h2\") ? document.querySelector(\".shopStoreTitle h2\").textContent.trim() : null;\n  out.titleSpan = document.querySelector(\".shopStoreTitle span\") ? document.querySelector(\".shopStoreTitle span\").textContent.trim() : null;\n  out.titleRect = rect(\".shopStoreTitle\");\n  out.chipRect = rect(\".shopStoreChip\");\n  const chip = document.querySelector(\".shopStoreChip\");\n  out.chipText = chip ? chip.textContent.replace(/\\s+/g, \" \").trim() : null;\n  const rt = document.querySelector(\".shopStoreChipRating\");\n  out.ratingText = rt ? rt.textContent.replace(/\\s+/g, \" \").trim() : null;\n  const st = document.querySelector(\".shopStoreChipStats\");\n  out.statsText = st ? st.textContent.replace(/\\s+/g, \" \").trim() : null;\n  const ct = document.querySelector(\".shopStoreCityTag\");\n  out.cityText = ct ? ct.textContent.replace(/\\s+/g, \" \").trim() : null;\n  out.logoRect = rect(\".shopStoreLogo\");\n  out.cityRect = rect(\".shopStoreCityTag\");\n  const logo = document.querySelector(\".shopStoreLogo\");\n  const cs = getComputedStyle(logo);\n  out.logoBorder = cs.border;\n  out.logoShadow = cs.boxShadow;\n  out.logoRadius = cs.borderRadius;\n  out.logoBg = cs.backgroundImage;\n  const fb = document.querySelector(\".shopStoreActions .shopStoreFollow\");\n  out.followText = fb ? fb.textContent.replace(/\\s+/g, \" \").trim() : null;\n  if (fb) { const fcs = getComputedStyle(fb); out.followBg = fcs.backgroundColor; out.followRadius = fcs.borderRadius; out.followShadow = fcs.boxShadow; }\n  if (out.titleRect && out.chipRect) {\n    out.chipBelowTitle = out.chipRect.top >= out.titleRect.bottom;\n    out.verticalGap = out.chipRect.top - out.titleRect.bottom;\n  }\n  if (out.logoRect && out.cityRect) {\n    const lc = out.logoRect.left + out.logoRect.width / 2;\n    const cc = out.cityRect.left + out.cityRect.width / 2;\n    out.cityBelowLogo = out.cityRect.top >= out.logoRect.bottom && Math.abs(lc - cc) < 20;\n    out.cityGap = out.cityRect.top - out.logoRect.bottom;\n  }\n  const cardEl = document.querySelector(\".shopStoreIdentityCard\");\n  const cardRect = cardEl.getBoundingClientRect();\n  out.logoOverhang = Math.round(cardRect.top - out.logoRect.top);\n  out.cardPaddingTop = getComputedStyle(cardEl).paddingTop;\n  return JSON.stringify(out);\n}\n\nmain().then(function (o) { console.log(\"PROBE_RESULT \" + o); }).catch(function (e) { console.log(\"PROBE_ERROR \" + e.message); });", awaitPromise: true, returnByValue: true });
if (evt.exceptionDetails) {
  console.log("EXC: " + JSON.stringify(evt.exceptionDetails.exception ? evt.exceptionDetails.exception.description : evt.exceptionDetails));
} else {
  console.log(evt.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("C:/Users/novin/Desktop/zibaban/shots/phase3/p63.png", Buffer.from(shot.data, "base64"));
  console.log("SHOT saved p63");
}
socket.end();
process.exit(0);