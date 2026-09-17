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
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(phone, password) { await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)'); await sleep(400); await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(800); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(9000); for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); } await ev("document.documentElement.style.scrollBehavior='auto'"); }
const info = '(() => { const h = document.querySelector(".profileHero.is-artist"); if (!h) return null; const rect = (el) => { const r = el.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) }; }; const poster = h.querySelector(".artistHeroPoster"); const av = h.querySelector(".profileAvatarImage"); const copy = h.querySelector(".profileHeroCopy"); const badge = h.querySelector(".artistHeroBadge"); const stats = h.querySelector(".artistHeroStats"); const tabs = document.querySelector(".profileModeRail.is-panelRail.is-artist-rail"); const heroRect = rect(h); return { hero: rect(h), poster: poster ? rect(poster) : null, posterBg: poster ? getComputedStyle(poster).backgroundImage.slice(0, 40) : null, avatar: av ? rect(av) : null, copy: copy ? rect(copy) : null, badge: badge ? rect(badge) : null, stats: stats ? rect(stats) : null, tabs: tabs ? rect(tabs) : null, heroDisp: getComputedStyle(h).display, heroH: heroRect.h }; })()';
const out = {};
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09122223344", "password123");
await load();
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
out.withPosterDesktop = await ev(info);
const s1 = await send("Page.captureScreenshot", { format: "png" }); if (s1.result?.data) writeFileSync("shots/phase3/p13-artist-poster-desktop.png", Buffer.from(s1.result.data, "base64"));
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await load();
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
out.withPosterMobile = await ev(info);
const s2 = await send("Page.captureScreenshot", { format: "png" }); if (s2.result?.data) writeFileSync("shots/phase3/p13-artist-poster-mobile.png", Buffer.from(s2.result.data, "base64"));
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
console.error("DONE-MARKER");