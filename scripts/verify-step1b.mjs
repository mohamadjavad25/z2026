/**
 * Post-cleanup verification: all roles + settings pages, console errors, no AI/shell texts.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const PORT = 9333;
const OUT = "shots/verify-step1b";
mkdirSync(OUT, { recursive: true });

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") {
    consoleErrors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 300));
  }
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 250);
    consoleErrors.push(m.params.type.toUpperCase() + ": " + txt);
  }
  if (m.method === "Log.entryAdded" && (m.params.entry.level === "error" || m.params.entry.level === "warning")) {
    consoleErrors.push("LOG " + m.params.entry.level + ": " + m.params.entry.text.slice(0, 250));
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++idc; pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200);
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
async function snap(name) {
  const s = await send("Page.captureScreenshot", { format: "png" });
  if (s.result?.data) writeFileSync(OUT + "/" + name + ".png", Buffer.from(s.result.data, "base64"));
}
const report = {};
async function login(phone, password) {
  await ev(`fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "${phone}", password: "${password}" }) }).then(r => r.json()).then(j => ({ ok: true, j })).catch(e => ({ err: String(e) }))`);
  await sleep(600);
}
async function load(waitMs = 8000) {
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(waitMs);
  await ev("document.documentElement.style.scrollBehavior='auto'; document.body.style.scrollBehavior='auto'");
}

const AI_TEXT = /شل|استودیو|ایجاد مدل|حریم خصوصی AI|استودیو AI|پردازش خصوصی|لیدهای AI|مدل‌های من|پروفایل زیبایی من/;

async function checkRole(label, phone, settingsAria) {
  await login(phone, "password123");
  await load();
  const body1 = await ev("document.body.innerText");
  const aiHome = AI_TEXT.test(body1);
  // open settings
  if (settingsAria) {
    const found = await ev(`(() => { const el = document.querySelector('[aria-label="${settingsAria}"]'); if (!el) return false; el.click(); return true; })()`);
    await sleep(1500);
    const body2 = await ev("document.body.innerText");
    report[label] = {
      aiHome,
      settingsOpened: found,
      aiSettings: AI_TEXT.test(body2),
      settingsSnippet: body2.slice(0, 260),
    };
    await snap(label + "-settings");
  } else {
    report[label] = { aiHome, settingsOpened: false };
  }
}

await checkRole("client", "09121112233", "تنظیمات پروفایل");
await checkRole("artist", "09122223344", "تنظیمات پروفایل");
await checkRole("salon", "09123334455", "تنظیمات پروفایل");
await checkRole("shop", "09124445566", "آمار و مالی فروشگاه");

// shop settings via rail (تنظیمات)
await login("09124445566", "password123");
await load();
await ev(`(() => { const els = [...document.querySelectorAll('button')]; const b = els.find(x => (x.innerText||'').trim() === 'تنظیمات'); if (b) { b.click(); return true; } return false; })()`);
await sleep(1500);
const shopSettingsText = await ev("document.body.innerText");
report.shopRailSettings = { ai: AI_TEXT.test(shopSettingsText), snippet: shopSettingsText.slice(0, 260) };
await snap("shop-settings");

// mobile client
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await login("09121112233", "password123");
await load();
const mobText = await ev("document.body.innerText");
report.mobileClient = { ai: AI_TEXT.test(mobText) };
await snap("mobile-client");

report.consoleErrors = consoleErrors.filter((e) => !/salon-collabs/.test(e));
writeFileSync(OUT + "/report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
ws.close();
