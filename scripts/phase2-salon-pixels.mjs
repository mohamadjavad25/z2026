
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 150); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09121112233", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(600);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(7500);
await ev("document.documentElement.style.scrollBehavior='auto'");
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("سالن")); if (b) b.click(); return !!b; })()');
await sleep(1500);
await ev('(() => { const el = document.querySelector(".salonRow"); if (el) el.click(); return !!el; })()');
await sleep(2500);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("shots/phase2-before/salon-chip-probe.png", Buffer.from(shot.result.data, "base64"));
// Sample pixels via canvas in the page
const sample = await ev('(async () => { const res = await fetch("data:image/png;base64,' + shot.result.data + '"); const blob = await res.blob(); const bmp = await createImageBitmap(blob); const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext("2d"); ctx.drawImage(bmp, 0, 0); const pts = [[866,239],[900,240],[840,250],[860,235],[880,245],[870,255],[830,230]]; return pts.map(p => { const d = ctx.getImageData(p[0], p[1], 1, 1).data; return { p, rgb: [d[0], d[1], d[2]] }; }); })()');
console.log(JSON.stringify(sample, null, 2));
ws.close();
