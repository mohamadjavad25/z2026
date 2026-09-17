
import { readFileSync, writeFileSync } from "node:fs";
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

const b64 = (f) => readFileSync("shots/phase2/" + f).toString("base64");
const pair = (leftFile, rightFile, outName, labelL, labelR) => {
  const a = b64(leftFile), b2 = b64(rightFile);
  return ev('(async () => {' +
    'const [ia, ib] = await Promise.all(["data:image/png;base64,' + a + '", "data:image/png;base64,' + b2 + '"].map(async src => { const bmp = await createImageBitmap(await (await fetch(src)).blob()); const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext("2d"); ctx.drawImage(bmp, 0, 0); return cv; }));' +
    'const W = ia.width + ib.width, H = Math.max(ia.height, ib.height);' +
    'const out = new OffscreenCanvas(W, H); const ctx = out.getContext("2d");' +
    'ctx.fillStyle = "#1c202c"; ctx.fillRect(0, 0, W, H);' +
    'ctx.drawImage(ia, 0, 0); ctx.drawImage(ib, ia.width, 0);' +
    'ctx.fillStyle = "#ffffff"; ctx.font = "bold 34px Tahoma"; ctx.textAlign = "center";' +
    'ctx.fillText(' + JSON.stringify(labelL) + ', ia.width / 2, 40);' +
    'ctx.fillText(' + JSON.stringify(labelR) + ', ia.width + ib.width / 2, 40);' +
    'const blob = await out.convertToBlob(); const buf = await blob.arrayBuffer();' +
    'const bytes = new Uint8Array(buf); let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return "data:image/png;base64," + btoa(bin);' +
    '})()');
};

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
// Pair 1: salon vs shop (rated + products)
let d1 = await pair("salon-public.png", "shop-many-rated.png", "cmp-salon-shop", "صفحه سالن (الگو)", "صفحه فروشگاه (بازسازی)");
const img = await (await fetch(d1)).arrayBuffer();
writeFileSync("shots/phase2/compare-salon-shop.png", Buffer.from(img));
// Pair 2: salon vs shop empty
let d2 = await pair("salon-public.png", "shop-empty.png", "cmp-salon-shop-empty", "صفحه سالن (الگو)", "صفحه فروشگاه (خالی)");
const img2 = await (await fetch(d2)).arrayBuffer();
writeFileSync("shots/phase2/compare-salon-shop-empty.png", Buffer.from(img2));
console.log("composed");
ws.close();
