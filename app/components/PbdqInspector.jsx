"use client";

import { useEffect, useRef } from "react";

function getSelector(el) {
  if (!el || el === document.body) return "body";
  const parts = [];
  let cur = el;
  for (let i = 0; i < 4 && cur && cur !== document.body; i++) {
    let sel = cur.tagName.toLowerCase();
    if (cur.id) { sel += `#${cur.id}`; parts.unshift(sel); break; }
    if (cur.className && typeof cur.className === "string") {
      const cls = cur.className.trim().split(/\s+/).slice(0, 2).join(".");
      if (cls) sel += `.${cls}`;
    }
    // nth-child for uniqueness
    const parent = cur.parentElement;
    if (parent) {
      const idx = Array.from(parent.children).indexOf(cur) + 1;
      sel += `:nth-child(${idx})`;
    }
    parts.unshift(sel);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

export default function PbdqInspector() {
  const enabledRef = useRef(false);
  const lastHoverRef = useRef(null);
  const styleRef = useRef(null);

  useEffect(() => {
    // inject highlight style once
    if (!styleRef.current) {
      const s = document.createElement("style");
      s.id = "pbdq-inspector-style";
      s.textContent = `
        .pbdq-hover { outline: 2px solid var(--pbdq-accent, #64748b) !important; outline-offset: 1px !important; background: rgba(100,116,139,0.08) !important; cursor: crosshair !important; }
        .pbdq-selected { outline: 2px solid var(--pbdq-accent, #64748b) !important; background: rgba(100,116,139,0.14) !important; }
      `;
      document.head.appendChild(s);
      styleRef.current = s;
    }

    const isInsideIframe = window.self !== window.top;
    // auto-enable when inside iframe for easier testing; parent can still toggle off
    if (isInsideIframe) {
      // start enabled if parent already asked, otherwise wait for message — but enable by default for debug
      // we keep disabled initially and rely on parent message, plus periodic ready announce
      console.log("[pbdq] inspector mounted, inside iframe:", isInsideIframe);
    }

    function onMessage(e) {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "pbdq:enable") {
        console.log("[pbdq] enable message:", e.data.enabled);
        enabledRef.current = !!e.data.enabled;
        if (!enabledRef.current && lastHoverRef.current) {
          lastHoverRef.current.classList.remove("pbdq-hover");
          lastHoverRef.current = null;
        }
      }
    }
    window.addEventListener("message", onMessage);
    let t1, t2;
    let onPing;
    if (isInsideIframe) {
      const sendReady = () => window.parent.postMessage({ type: "pbdq:ready" }, "*");
      sendReady();
      t1 = setTimeout(sendReady, 500);
      t2 = setTimeout(sendReady, 1500);
      onPing = (e) => {
        if (e.data?.type === "pbdq:ping") window.parent.postMessage({ type: "pbdq:ready" }, "*");
      };
      window.addEventListener("message", onPing);
    }

    function onOver(e) {
      if (!enabledRef.current) return;
      const el = e.target;
      if (!el || el.closest("#pbdq-inspector-style")) return;
      if (lastHoverRef.current && lastHoverRef.current !== el) {
        lastHoverRef.current.classList.remove("pbdq-hover");
      }
      if (el instanceof HTMLElement && el !== document.body && el !== document.documentElement) {
        el.classList.add("pbdq-hover");
        lastHoverRef.current = el;
      }
    }
    function onOut(e) {
      if (!enabledRef.current) return;
      const el = e.target;
      if (el instanceof HTMLElement) el.classList.remove("pbdq-hover");
    }
    function onClick(e) {
      if (!enabledRef.current) return;
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (el === document.body || el === document.documentElement) return;
      e.preventDefault();
      e.stopPropagation();
      // remove hover
      el.classList.remove("pbdq-hover");
      lastHoverRef.current = null;

      const selector = getSelector(el);
      const html = el.outerHTML.slice(0, 800);
      const text = (el.innerText || el.textContent || "").trim().slice(0, 300);
      const rect = el.getBoundingClientRect();
      const payload = {
        selector,
        tag: el.tagName.toLowerCase(),
        className: el.className?.toString().slice(0, 200) || "",
        id: el.id || "",
        html,
        text,
        rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      };
      if (isInsideIframe) {
        window.parent.postMessage({ type: "pbdq:element", payload }, "*");
      } else {
        window.dispatchEvent(new CustomEvent("pbdq:element", { detail: payload }));
      }
    }

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("message", onMessage);
      if (onPing) window.removeEventListener("message", onPing);
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
