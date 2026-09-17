
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09121112233", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(600);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(7000);
await ev("document.documentElement.style.scrollBehavior='auto'");
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()');
await sleep(1200);
// GLORY (empty, new chip)
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()');
await sleep(2500);
console.log("NEWCHIP probe:", await ev('(() => { const c = document.querySelector(".shopStoreNewChip"); if (!c) return null; const r = c.getBoundingClientRect(); const card = document.querySelector(".shopStoreRatingCard").getBoundingClientRect(); const out = []; for (const f of [0.6, 0.62, 0.64, 0.66]) { c.style.fontSize = f + "rem"; c.style.padding = "0 8px"; out.push({ f, w: Math.round(c.getBoundingClientRect().width) }); } return { cardW: Math.round(card.width), sizes: out, text: c.innerText }; })()'));
console.log("DOT:", await ev('(() => { const i = document.querySelector(".shopStoreVerifiedChip i"); if (!i) return null; const r = i.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), bg: getComputedStyle(i).backgroundColor }; })()'));
// DOCK copy structure (empty state)
console.log("DOCKCOPY:", await ev('(() => { const c = document.querySelector(".shopStoreDockCopy"); if (!c) return null; const cs = getComputedStyle(c); const s = c.querySelector("strong"); const sm = c.querySelector("small"); const sr = s ? s.getBoundingClientRect() : null; const mr = sm ? sm.getBoundingClientRect() : null; return { disp: cs.display, w: Math.round(c.getBoundingClientRect().width), strong: s ? s.innerText : null, strongR: sr ? { w: Math.round(sr.width), h: Math.round(sr.height) } : null, small: sm ? sm.innerText : null, smallR: mr ? { w: Math.round(mr.width), h: Math.round(mr.height) } : null }; })()'));
// Back to loiih for 2-button actions
await ev('(() => { const b = document.querySelector(".shopStoreBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1200);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("loiih")); if (el) el.click(); return !!el; })()');
await sleep(2500);
console.log("ACTIONS loiih:", await ev('(() => { const a = document.querySelector(".shopStoreActions"); if (!a) return null; const cs = getComputedStyle(a); const btns = [...a.querySelectorAll("button")].map(b => { const r = b.getBoundingClientRect(); return { t: b.innerText.slice(0, 16), x: Math.round(r.x), w: Math.round(r.width), c: b.className }; }); return { grid: cs.gridTemplateColumns, dir: cs.direction, btns }; })()'));
// chip dot pixel probe
const shot = await send("Page.captureScreenshot", { format: "png" });
const px = await ev('(async () => { const bmp = await createImageBitmap(await (await fetch("data:image/png;base64,' + shot.result.data + '")).blob()); const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext("2d"); ctx.drawImage(bmp, 0, 0); const pts = [[896, 235], [900, 235], [890, 235], [850, 230]]; return pts.map(p => { const d = ctx.getImageData(p[0], p[1], 1, 1).data; return [p[0], p[1], d[0], d[1], d[2]]; }); })()');
console.log("CHIP PIXELS:", JSON.stringify(px));
ws.close();
