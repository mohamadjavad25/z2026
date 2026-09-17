/**
 * CDP browser driver for capturing rendered snapshots of the zibaban app.
 * Usage: node scripts/cdp-drive.mjs <steps.json> <outDir>
 * Expects a headless Edge/Chrome already running with --remote-debugging-port=9333.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const PORT = 9333;
const stepsPath = process.argv[2];
const outDir = process.argv[3] || "shots";
if (!stepsPath) {
  console.error("usage: node scripts/cdp-drive.mjs <steps.json> [outDir]");
  process.exit(1);
}
const steps = JSON.parse(readFileSync(stepsPath, "utf8"));
mkdirSync(outDir, { recursive: true });

async function getPageWsUrl() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");
  return page.webSocketDebuggerUrl;
}

const ws = new WebSocket(await getPageWsUrl());
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = () => reject(new Error("ws error"));
});
let idc = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++idc;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error("eval failed: " + JSON.stringify(r.result.exceptionDetails).slice(0, 800));
  }
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXTRACT = `(() => {
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity || "1") > 0.05;
  };
  const all = [...document.querySelectorAll("body *")].filter(vis);
  const bgMap = new Map(), txMap = new Map(), fontMap = new Map();
  for (const el of all) {
    const s = getComputedStyle(el);
    const bg = s.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") bgMap.set(bg, (bgMap.get(bg) || 0) + 1);
    const tx = s.color;
    if (tx) txMap.set(tx, (txMap.get(tx) || 0) + 1);
    const f = (s.fontFamily || "").split(",")[0].replace(/["']/g, "") + " / " + s.fontSize;
    fontMap.set(f, (fontMap.get(f) || 0) + 1);
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ v: k, n: v }));
  const controls = [...document.querySelectorAll("button, a, input, select, textarea, [role='button'], [role='tab'], [role='menuitem'], [role='switch']")]
    .filter(vis).slice(0, 140)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      t: clean(el.innerText || el.value || "").slice(0, 50),
      ph: el.getAttribute ? (el.getAttribute("placeholder") || "") : "",
      href: el.getAttribute ? (el.getAttribute("href") || "") : "",
      aria: el.getAttribute ? (el.getAttribute("aria-label") || "") : "",
    }))
    .filter((c) => c.t || c.ph || c.href || c.aria);
  const imgs = [...document.querySelectorAll("img")].filter(vis).map((i) => ({ src: i.getAttribute("src") || "", alt: i.getAttribute("alt") || "" })).slice(0, 40);
  const headings = [...document.querySelectorAll("h1,h2,h3,h4")].filter(vis).map((h) => clean(h.innerText)).filter(Boolean).slice(0, 25);
  return {
    url: location.href,
    title: document.title,
    viewport: { w: innerWidth, h: innerHeight },
    bodyBg: getComputedStyle(document.body).backgroundColor,
    elCount: all.length,
    text: clean(document.body.innerText).slice(0, 9000),
    headings,
    bgs: top(bgMap, 12),
    textColors: top(txMap, 10),
    fonts: top(fontMap, 10),
    controls,
    imgs,
  };
})()`;

async function snap(name) {
  const data = await evalJs(EXTRACT);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const file = join(outDir, `${name}.png`);
  if (!shot.result?.data) throw new Error("captureScreenshot returned no data: " + JSON.stringify(shot.error || shot));
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(data, null, 1));
  console.log("SNAP_BEGIN " + name);
  console.log("SNAP_END " + name + " -> " + file);
}

async function clickText(text, nth = 0) {
  const found = await evalJs(`(() => {
    const q = ${JSON.stringify(text)};
    const all = [...document.querySelectorAll("button, a, [role='button'], [role='tab'], label, [onclick]")];
    const hits = all.filter((el) => {
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      return t === q || t.includes(q);
    });
    const el = hits[${nth}];
    if (!el) return -1;
    el.scrollIntoView({ block: "center" });
    el.click();
    return hits.length;
  })()`);
  if (found < 0) throw new Error(`clickText not found: ${text}`);
  return found;
}

async function run() {
  await send("DOM.enable");
  await send("DOM.getDocument", { depth: -1, pierce: true });
  for (const step of steps) {
    const a = step.action;
    try {
      if (a === "fixScroll") {
        await evalJs(`document.documentElement.style.scrollBehavior = "auto"; document.body.style.scrollBehavior = "auto"; 'ok'`);
        console.log(">> fixScroll");
      } else if (a === "viewport") {
        await send("Emulation.setDeviceMetricsOverride", {
          width: step.width, height: step.height, deviceScaleFactor: 1, mobile: !!step.mobile,
        });
        console.log(">> viewport", step.width + "x" + step.height);
      } else if (a === "goto") {
        await send("Page.navigate", { url: step.url });
        await sleep(step.waitMs || 4000);
      } else if (a === "reload") {
        await send("Page.reload", { ignoreCache: true });
        await sleep(step.waitMs || 5000);
      } else if (a === "wait") {
        await sleep(step.ms);
      } else if (a === "waitFor") {
        const deadline = Date.now() + (step.timeout || 15000);
        let ok = false;
        while (Date.now() < deadline) {
          const has = await evalJs(`document.body && document.body.innerText.includes(${JSON.stringify(step.text)})`);
          if (has) { ok = true; break; }
          await sleep(500);
        }
        if (!ok) throw new Error("waitFor timeout: " + step.text);
      } else if (a === "snap") {
        await snap(step.name);
      } else if (a === "clickText") {
        const n = await clickText(step.text, step.nth || 0);
        console.log(">> clicked", JSON.stringify(step.text), "hits:", n);
        await sleep(step.afterMs || 1200);
      } else if (a === "clickJs") {
        const n = await evalJs(step.expression);
        console.log(">> clickJs", n);
        await sleep(step.afterMs || 1200);
      } else if (a === "eval") {
        const v = await evalJs(step.expression);
        console.log(">> eval", step.label || "", JSON.stringify(v).slice(0, 400));
      } else if (a === "setInput") {
        await evalJs(`(() => {
          const el = document.querySelector(${JSON.stringify(step.selector)});
          if (!el) return false;
          const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype
            : el.tagName === "SELECT" ? window.HTMLSelectElement.prototype
            : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
          setter.call(el, ${JSON.stringify(step.value)});
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        })()`);
        console.log(">> setInput", step.selector, "=", step.value);
      } else if (a === "clickSel") {
        const obj = await send("Runtime.evaluate", {
          expression: `document.querySelector(${JSON.stringify(step.selector)})`,
          awaitPromise: true,
        });
        const objId = obj.result?.result?.objectId;
        if (!objId) throw new Error("clickSel not found: " + step.selector);
        await send("DOM.getDocument", { depth: -1, pierce: true });
        const node = await send("DOM.requestNode", { objectId: objId });
        const nodeId = node.result.nodeId;
        await send("DOM.scrollIntoViewIfNeeded", { nodeId });
        let box = null, x = -1, y = -1;
        for (let i = 0; i < 40; i++) {
          await sleep(250);
          box = await send("DOM.getBoxModel", { nodeId });
          if (box.result?.model) {
            const c = box.result.model.content;
            x = Math.round((c[0] + c[2]) / 2);
            y = Math.round((c[1] + c[5]) / 2);
            if (x > 0 && y > 0 && y < 900) break;
          }
        }
        if (x < 0 || y < 0 || y >= 900) throw new Error("clickSel not in viewport: " + step.selector);
        // hit-check: find a point on the element that actually hits it (avoid sticky overlays)
        const hit = await evalJs(`(() => {
          const el = document.querySelector(${JSON.stringify(step.selector)});
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const ys = [r.top + 30, r.top + r.height / 2, r.top + r.height - 20];
          const xs = [r.left + r.width / 2];
          for (const yy of ys) {
            for (const xx of xs) {
              if (xx <= 0 || yy <= 0 || yy >= 900) continue;
              const topEl = document.elementFromPoint(xx, yy);
              if (topEl && (el === topEl || el.contains(topEl) || topEl.contains(el))) {
                return { x: Math.round(xx), y: Math.round(yy) };
              }
            }
          }
          return false;
        })()`);
        if (!hit) throw new Error("clickSel no hit point: " + step.selector);
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: hit.x, y: hit.y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: hit.x, y: hit.y, button: "left", clickCount: 1 });
        console.log(">> clickSel", step.selector, "@", hit.x + "," + hit.y);
        await sleep(step.afterMs || 1600);
      } else if (a === "clickAt") {
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: step.x, y: step.y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: step.x, y: step.y, button: "left", clickCount: 1 });
        console.log(">> clickAt", step.x + "," + step.y);
        await sleep(step.afterMs || 1000);
      } else if (a === "clearCookies") {
        await send("Network.clearBrowserCookies");
        console.log(">> cookies cleared");
      } else if (a === "login") {
        const r = await evalJs(`fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(${JSON.stringify({ phone: step.phone, password: step.password })})
        }).then((res) => res.json()).then((j) => ({ ok: true, j })).catch((e) => ({ ok: false, err: String(e) }))`);
        console.log(">> login", step.phone, JSON.stringify(r).slice(0, 250));
        await sleep(step.afterMs || 800);
      } else if (a === "register") {
        const r = await evalJs(`fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(${JSON.stringify({
            type: step.type, name: step.name, area: step.area || "", service: step.service || "",
            phone: step.phone, password: step.password,
          })})
        }).then((res) => res.json()).then((j) => ({ ok: true, j })).catch((e) => ({ ok: false, err: String(e) }))`);
        console.log(">> register", step.type, step.phone, JSON.stringify(r).slice(0, 300));
        await sleep(step.afterMs || 800);
      } else if (a === "logout") {
        await evalJs(`fetch("/api/auth/logout", { method: "POST" }).then(() => true).catch(() => true)`);
        console.log(">> logout");
        await sleep(500);
      } else if (a === "realClick") {
        const obj = await send("Runtime.evaluate", {
          expression: `(() => {
            const q = ${JSON.stringify(step.text)};
            const all = [...document.querySelectorAll("button, a, article, [role='button'], [role='tab'], [onclick], [class*='Card'], [class*='card'], [class*='Post'], [class*='post'], li, div")];
            const hits = all.filter((el) => {
              const r = el.getBoundingClientRect();
              if (r.width < 2 || r.height < 2 || r.height > 700) return false;
              const s = getComputedStyle(el);
              if (s.visibility === "hidden" || s.display === "none" || s.pointerEvents === "none") return false;
              const t = (el.innerText || "").replace(/\s+/g, " ").trim();
              return t === q || t.includes(q);
            });
            const el = hits[${step.nth || 0}];
            return el || null;
          })()`,
          awaitPromise: true,
        });
        const objId = obj.result?.result?.objectId;
        if (!objId) throw new Error("realClick not found: " + step.text);
        await send("DOM.getDocument", { depth: -1, pierce: true });
        const node = await send("DOM.requestNode", { objectId: objId });
        const nodeId = node.result.nodeId;
        await send("DOM.scrollIntoViewIfNeeded", { nodeId });
        let box = null, x = -1, y = -1;
        for (let i = 0; i < 40; i++) {
          await sleep(250);
          box = await send("DOM.getBoxModel", { nodeId });
          if (box.result?.model) {
            const c = box.result.model.content;
            x = Math.round((c[0] + c[2]) / 2);
            y = Math.round((c[1] + c[5]) / 2);
            if (x > 0 && y > 0 && y < 900) break;
          }
        }
        if (x < 0 || y < 0 || y >= 900) throw new Error("realClick not in viewport: " + step.text);
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        console.log(">> realClick", JSON.stringify(step.text), "nth", step.nth || 0, "@", x + "," + y);
        await sleep(step.afterMs || 1600);
      } else if (a === "realClickAria") {
        const obj = await send("Runtime.evaluate", {
          expression: `document.querySelector('[aria-label=${JSON.stringify(step.aria)}]')`,
          awaitPromise: true,
        });
        const objId = obj.result?.result?.objectId;
        if (!objId) throw new Error("realClickAria not found: " + step.aria);
        const node = await send("DOM.requestNode", { objectId: objId });
        const nodeId = node.result.nodeId;
        await send("DOM.scrollIntoViewIfNeeded", { nodeId });
        let box = null, x = -1, y = -1;
        for (let i = 0; i < 40; i++) {
          await sleep(250);
          box = await send("DOM.getBoxModel", { nodeId });
          if (box.result?.model) {
            const c = box.result.model.content;
            x = Math.round((c[0] + c[2]) / 2);
            y = Math.round((c[1] + c[5]) / 2);
            if (x > 0 && y > 0 && y < 900) break;
          }
        }
        if (x < 0 || y < 0 || y >= 900) throw new Error("realClickAria not in viewport: " + step.aria);
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        console.log(">> realClickAria", step.aria, "@", x + "," + y);
        await sleep(step.afterMs || 1600);
      } else if (a === "scrollTo") {
        await evalJs(`window.scrollTo({ top: ${step.y || 400}, behavior: "instant" })`);
        await sleep(400);
      } else {
        throw new Error("unknown action " + a);
      }
    } catch (e) {
      console.error("STEP_FAILED " + JSON.stringify(step) + " :: " + e.message);
      if (step.fatal) throw e;
    }
  }
  ws.close();
  console.log("DONE");
}

run().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
