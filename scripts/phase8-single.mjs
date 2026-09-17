import { writeFileSync } from "node:fs";
const WHICH = process.argv[2] || "shop";
const PHONE = process.argv[3] || "09124445566";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 150));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 150));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 10000); });
const ev = async (expression, retries = 2) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await sleep(5000); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(phone, password) {
  await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)');
  await sleep(500);
  for (let i = 0; i < 4; i++) { const r = await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); if (r !== "TIMEOUT" && r !== "EVAL_ERR") break; await sleep(2500); }
  await sleep(700);
}
async function setFile(selector, path) { const doc = await send("DOM.getDocument", { depth: -1 }); const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector }); if (!q.result?.nodeId) return false; await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [path] }); return true; }
async function tapProfile() { await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()'); await sleep(2000); }
async function load() {
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(10000);
  for (let i = 0; i < 3; i++) {
    const r = await ev("(() => !!document.querySelector('.appShell'))()", 1);
    if (r === true) break;
    await sleep(2500);
  }
  await ev("document.documentElement.style.scrollBehavior='auto'", 1);
  await sleep(400);
}
await send("Runtime.enable"); await send("DOM.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login(PHONE, "password123");
await load();
await tapProfile();
const out = { which: WHICH };
if (WHICH === "salon") {
  out.creatorBtn = await ev('(() => !!document.querySelector(".salonHeroAvatarFrame .salonHeroStoryCreateIcon"))()', 1);
  for (let i = 0; i < 4 && !out.creatorBtn; i++) {
    await sleep(2500);
    out.creatorBtn = await ev('(() => !!document.querySelector(".salonHeroAvatarFrame .salonHeroStoryCreateIcon"))()', 1);
  }
  if (out.creatorBtn) {
    await ev('(() => { const b = document.querySelector(".salonHeroAvatarFrame .salonHeroStoryCreateIcon"); if (b) b.click(); return !!b; })()');
    await sleep(1500);
    out.overlay = await ev('(() => !!document.querySelector(".salonStoryCreatorOverlay"))()', 1);
    out.label = await ev('(() => document.querySelector(".salonStoryCreatorHead span")?.innerText?.trim() || null)()', 1);
    const doc = await send("DOM.getDocument", { depth: -1 });
    const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: ".salonStoryCreatorUploads input[accept='video/*']" });
    out.inputFound = !!q.result?.nodeId;
    if (q.result?.nodeId) {
      await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: ["C:\\Users\\novin\\Desktop\\zibaban\\shots\\phase3\\test-story.mp4"] });
    }
    await sleep(6000);
    out.previewHasVideo = await ev('(() => document.querySelector(".salonStoryCreatorPreview")?.classList.contains("has-video") || false)()', 2);
    await ev('(() => { const b = document.querySelector(".salonStoryPublishButton"); if (b) b.click(); return !!b; })()');
    await sleep(1500);
    out.toast = await ev('(() => document.querySelector(".appToast span")?.innerText || null)()', 2);
    // own salon public → story
    await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("سالن")); if (b) b.click(); return !!b; })()');
    await sleep(2500);
    await ev('(() => { const el = document.querySelector(".salonRow"); if (el) el.click(); return !!el; })()');
    await sleep(2500);
    out.hasVideo = await ev('(() => { const v = document.querySelector(".salonPublicHero video"); return v ? (v.getAttribute("src") || "").slice(0, 40) || null : null; })()', 2);
    await ev('(() => document.querySelector(".salonPublicLogoSlot")?.click())()');
    await sleep(800);
    out.storyOpen = await ev('(() => document.querySelector(".salonPublicProfile")?.classList.contains("is-story-open") || false)()', 2);
    const s1 = await send("Page.captureScreenshot", { format: "png" }); if (s1.result?.data) writeFileSync("shots/phase3/p8-salon-story-play.png", Buffer.from(s1.result.data, "base64"));
  }
} else if (WHICH === "artist") {
  out.creatorBtn = await ev('(() => !!document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"))()', 1);
  for (let i = 0; i < 4 && !out.creatorBtn; i++) {
    await sleep(2500);
    out.creatorBtn = await ev('(() => !!document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"))()', 1);
  }
  if (out.creatorBtn) {
    await ev('(() => { const b = document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"); if (b) b.click(); return !!b; })()');
    await sleep(1500);
    out.overlay = await ev('(() => !!document.querySelector(".salonStoryCreatorOverlay"))()', 1);
    out.label = await ev('(() => document.querySelector(".salonStoryCreatorHead span")?.innerText?.trim() || null)()', 1);
    const doc = await send("DOM.getDocument", { depth: -1 });
    const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: ".salonStoryCreatorUploads input[accept='video/*']" });
    out.inputFound = !!q.result?.nodeId;
    if (q.result?.nodeId) {
      await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: ["C:\\Users\\novin\\Desktop\\zibaban\\shots\\phase3\\test-story.mp4"] });
    }
    await sleep(6000);
    out.previewHasVideo = await ev('(() => document.querySelector(".salonStoryCreatorPreview")?.classList.contains("has-video") || false)()', 2);
    await ev('(() => { const b = document.querySelector(".salonStoryPublishButton"); if (b) b.click(); return !!b; })()');
    await sleep(1500);
    out.toast = await ev('(() => document.querySelector(".appToast span")?.innerText || null)()', 2);
    const s1 = await send("Page.captureScreenshot", { format: "png" }); if (s1.result?.data) writeFileSync("shots/phase3/p8-artist-story-created.png", Buffer.from(s1.result.data, "base64"));
  }
}
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
console.error("DONE-MARKER");
