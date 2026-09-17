import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 130));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 20000); });
const ev = async (expression, retries = 2) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 4000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('(() => { const wrap = document.createElement("div"); wrap.id = "sk-test"; wrap.className = "uxSkeletonList is-card shopStoreCatalogSkeleton"; wrap.innerHTML = Array.from({ length: 4 }, () => `<div class="uxSkeletonItem"><span class="uxSkeletonBlock uxSkeletonMedia"></span><div class="uxSkeletonCopy"><span class="uxSkeletonBlock uxSkeletonLine is-title"></span><span class="uxSkeletonBlock uxSkeletonLine is-meta"></span></div></div>`).join(""); document.body.appendChild(wrap); return true; })()');
await sleep(500);
out.desktop = await ev('(() => { const w = document.getElementById("sk-test"); const cs = getComputedStyle(w); const items = [...w.querySelectorAll(".uxSkeletonItem")]; const media = w.querySelector(".uxSkeletonMedia"); const mcs = getComputedStyle(media); const title = w.querySelector(".uxSkeletonLine.is-title"); const meta = w.querySelector(".uxSkeletonLine.is-meta"); const tcs = getComputedStyle(title); const metacs = getComputedStyle(meta); const r0 = items[0].getBoundingClientRect(); const r1 = items[1].getBoundingClientRect(); const r2 = items[2].getBoundingClientRect(); return { grid: cs.gridTemplateColumns, gap: cs.gap, itemRadius: getComputedStyle(items[0]).borderRadius, itemW: Math.round(r0.width), colGapX: Math.round(r1.left - r0.right), rowGapY: Math.round(r2.top - r0.bottom), mediaAspect: mcs.aspectRatio, mediaH: Math.round(media.getBoundingClientRect().height), mediaRadius: mcs.borderRadius, titleW: tcs.width, metaW: metacs.width, shimmer: mcs.animation.includes("uxSkeletonShimmer"), bg: mcs.backgroundImage.slice(0, 30) }; })()');
const s1 = await send("Page.captureScreenshot", { format: "png" }); if (s1.result?.data) writeFileSync("shots/phase3/p19-skeleton-desktop.png", Buffer.from(s1.result.data, "base64"));
// mobile
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await ev('(() => { const old = document.getElementById("sk-test"); if (old) old.remove(); const wrap = document.createElement("div"); wrap.id = "sk-test"; wrap.className = "uxSkeletonList is-card shopStoreCatalogSkeleton"; wrap.innerHTML = Array.from({ length: 4 }, () => `<div class="uxSkeletonItem"><span class="uxSkeletonBlock uxSkeletonMedia"></span><div class="uxSkeletonCopy"><span class="uxSkeletonBlock uxSkeletonLine is-title"></span><span class="uxSkeletonBlock uxSkeletonLine is-meta"></span></div></div>`).join(""); document.body.appendChild(wrap); return true; })()');
await sleep(500);
out.mobile = await ev('(() => { const w = document.getElementById("sk-test"); const cs = getComputedStyle(w); const items = [...w.querySelectorAll(".uxSkeletonItem")]; const r0 = items[0].getBoundingClientRect(); const r1 = items[1].getBoundingClientRect(); return { grid: cs.gridTemplateColumns, gap: cs.gap, itemW: Math.round(r0.width), colGapX: Math.round(r1.left - r0.right) }; })()');
const s2 = await send("Page.captureScreenshot", { format: "png" }); if (s2.result?.data) writeFileSync("shots/phase3/p19-skeleton-mobile.png", Buffer.from(s2.result.data, "base64"));
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
console.error("DONE-MARKER");