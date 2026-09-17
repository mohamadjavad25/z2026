import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 20000); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true }); if (r.timeout) return "TIMEOUT"; if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 150); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const html = "<div class=\"uxSkeletonItem\"><span class=\"uxSkeletonBlock uxSkeletonMedia\"></span><div class=\"uxSkeletonCopy\"><span class=\"uxSkeletonBlock uxSkeletonLine is-title\"></span><span class=\"uxSkeletonBlock uxSkeletonLine is-meta\"></span></div></div>";
await ev("(() => { const c = document.createElement('div'); c.id = 'skc'; c.style.cssText = 'width:420px;padding:16px;background:#fff;border-radius:22px;margin:20px;'; const w = document.createElement('div'); w.className = 'uxSkeletonList is-card shopStoreCatalogSkeleton'; w.innerHTML = window.__skItems; c.appendChild(w); document.body.appendChild(c); return true; })()");
// set items first
await ev("window.__skItems = "<div class=\"uxSkeletonItem\"><span class=\"uxSkeletonBlock uxSkeletonMedia\"></span><div class=\"uxSkeletonCopy\"><span class=\"uxSkeletonBlock uxSkeletonLine is-title\"></span><span class=\"uxSkeletonBlock uxSkeletonLine is-meta\"></span></div></div>".repeat(4)")
await sleep(500);
out.g = await ev("(() => { const w = document.querySelector('#skc .shopStoreCatalogSkeleton'); if (!w) return 'NO'; const cs = getComputedStyle(w); const it = w.querySelectorAll('.uxSkeletonItem'); const m = w.querySelector('.uxSkeletonMedia'); const r0 = it[0].getBoundingClientRect(); const r1 = it[1].getBoundingClientRect(); const r2 = it[2].getBoundingClientRect(); return { grid: cs.gridTemplateColumns, gap: cs.gap, w0: Math.round(r0.width), gapX: Math.round(r1.left - r0.right), gapY: Math.round(r2.top - r0.bottom), aspect: getComputedStyle(m).aspectRatio, mediaH: Math.round(m.getBoundingClientRect().height), radius: getComputedStyle(it[0]).borderRadius, t1: Math.round(w.querySelector('.is-title').getBoundingClientRect().width), t2: Math.round(w.querySelector('.is-meta').getBoundingClientRect().width), shimmer: getComputedStyle(m).animation.includes('Shimmer') }; })()");
const s1 = await send("Page.captureScreenshot", { format: "png" }); if (s1.result?.data) writeFileSync("shots/phase3/p19-final-skeleton.png", Buffer.from(s1.result.data, "base64"));
// mobile
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await ev("(() => { const o = document.getElementById('skc'); if (o) o.remove(); const c = document.createElement('div'); c.id = 'skc'; c.style.cssText = 'width:350px;padding:14px;background:#fff;border-radius:22px;margin:10px;'; const w = document.createElement('div'); w.className = 'uxSkeletonList is-card shopStoreCatalogSkeleton'; w.innerHTML = window.__skItems; c.appendChild(w); document.body.appendChild(c); return true; })()");
await sleep(500);
out.m = await ev("(() => { const w = document.querySelector('#skc .shopStoreCatalogSkeleton'); if (!w) return 'NO'; const cs = getComputedStyle(w); const it = w.querySelectorAll('.uxSkeletonItem'); const r0 = it[0].getBoundingClientRect(); const r1 = it[1].getBoundingClientRect(); return { grid: cs.gridTemplateColumns, gap: cs.gap, w0: Math.round(r0.width), gapX: Math.round(r1.left - r0.right), hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; })()");
const s2 = await send("Page.captureScreenshot", { format: "png" }); if (s2.result?.data) writeFileSync("shots/phase3/p19-final-skeleton-mobile.png", Buffer.from(s2.result.data, "base64"));
console.log(JSON.stringify(out, null, 1));
ws.close();
console.error("DONE-MARKER");