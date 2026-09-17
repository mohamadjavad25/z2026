/**
 * Post-step-1 verification: load all roles, collect console errors, assert no studio/shell UI remains.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const PORT = 9333;
const OUT = "shots/verify-step1";
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
  if (s.result?.data) writeFileSync(OUT + "\\" + name + ".png", Buffer.from(s.result.data, "base64"));
}

const report = {};

async function load(url, waitMs = 8000) {
  await send("Page.navigate", { url });
  await sleep(waitMs);
}

async function login(phone, password) {
  const r = await ev(`fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "${phone}", password: "${password}" }) }).then(r => r.json()).then(j => ({ ok: true, j })).catch(e => ({ err: String(e) }))`);
  await sleep(600);
  return r;
}

async function checkRole(label, phone) {
  await login(phone, "password123");
  await load("http://localhost:3000/");
  await ev("document.documentElement.style.scrollBehavior='auto'; document.body.style.scrollBehavior='auto'");
  const bodyText = await ev("document.body.innerText");
  const sidebar = await ev(`[...document.querySelectorAll('.sideNav a')].map(a => a.innerText.trim())`);
  const bottomNav = await ev(`[...document.querySelectorAll('.bottomNav button')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim())`);
  const hasShell = /شل/.test(bodyText);
  const hasStudio = /استودیو/.test(bodyText);
  const hasCreateModel = /ایجاد مدل/.test(bodyText);
  const hasBeautyBoard = /پروفایل زیبایی من|مدل‌های من/.test(bodyText);
  report[label] = {
    sidebar, bottomNav,
    hasShell, hasStudio, hasCreateModel, hasBeautyBoard,
    bodyHead: bodyText.slice(0, 180),
  };
  await snap(label.replace(/\s+/g, "-"));
}

// 1) client
await checkRole("client", "09121112233");
// 2) shop + wallet check
await checkRole("shop", "09124445566");
// 3) salon
await checkRole("salon", "09123334455");
// 4) artist
await checkRole("artist", "09122223344");

// mobile client profile
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await login("09121112233", "password123");
await load("http://localhost:3000/");
await ev("document.documentElement.style.scrollBehavior='auto'; document.body.style.scrollBehavior='auto'");
const mobileText = await ev("document.body.innerText");
report.mobileClient = {
  hasShell: /شل/.test(mobileText),
  hasStudio: /استودیو/.test(mobileText),
  hasCreateModel: /ایجاد مدل/.test(mobileText),
  bodyHead: mobileText.slice(0, 200),
};
await snap("mobile-client");

report.consoleErrors = consoleErrors;
writeFileSync(OUT + "\\report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
ws.close();
