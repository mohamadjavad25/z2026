"use client";

import { useEffect } from "react";

/**
 * Turns off the on-screen keyboard's word suggestions, auto-correct,
 * auto-capitalisation and the browser's autofill strip on every text field
 * in the app (user's decision 2026-10-27: on some phones Gboard's
 * suggestions got in the way of typing). Applied once for the whole app
 * with a MutationObserver so new screens and sheets are covered too.
 * Login fields keep their `autocomplete` value so the SMS code and saved
 * passwords can still fill in.
 */
const KEEP_AUTOCOMPLETE = new Set(["one-time-code", "current-password", "new-password", "username"]);
const SKIP_TYPES = new Set(["checkbox", "radio", "file", "range", "color", "hidden", "button", "submit", "reset", "image"]);

function quiet(field) {
  if (field.tagName === "INPUT" && SKIP_TYPES.has(field.type)) return;
  if (field.getAttribute("spellcheck") !== "false") field.setAttribute("spellcheck", "false");
  if (field.getAttribute("autocorrect") !== "off") field.setAttribute("autocorrect", "off");
  if (field.getAttribute("autocapitalize") !== "off") field.setAttribute("autocapitalize", "off");
  const autocomplete = field.getAttribute("autocomplete");
  if (autocomplete !== "off" && !KEEP_AUTOCOMPLETE.has(autocomplete)) field.setAttribute("autocomplete", "off");
}

function quietAll(root) {
  if (root.matches?.("input, textarea")) quiet(root);
  root.querySelectorAll?.("input, textarea").forEach(quiet);
}

export function KeyboardSuggestionsOff() {
  useEffect(() => {
    quietAll(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") quiet(mutation.target);
        else mutation.addedNodes.forEach((node) => node.nodeType === 1 && quietAll(node));
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["autocomplete", "spellcheck", "autocorrect", "autocapitalize", "type"],
    });
    // Belt and braces: a field focused before the observer saw it.
    function onFocus(event) {
      if (event.target.matches?.("input, textarea")) quiet(event.target);
    }
    document.addEventListener("focusin", onFocus, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocus, true);
    };
  }, []);

  return null;
}
