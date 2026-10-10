"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { QrScanner } from "../../components/QrScanner";
import { connectScannedClient } from "../../shared/api/connections";
import { readScannedCode } from "../../shared/lib/connectCodes";

/**
 * Salon/artist side of «اسکن شو»: scan a client's personal code to connect.
 * The client then sees this salon/artist in «سالن و آرتیست من» and books from there.
 */
export function ScanCustomerAction({ onNotify }) {
  const [open, setOpen] = useState(false);
  // { state: "scanning" } | { state: "busy" } | { state: "done", name, already } | { state: "message", text }
  const [step, setStep] = useState({ state: "scanning" });

  function close() {
    setOpen(false);
    setStep({ state: "scanning" });
  }

  async function handleDetected(text) {
    const code = readScannedCode(text);
    if (code.kind !== "client") {
      setStep({ state: "message", text: code.kind === "profile" ? "این کد یک سالن یا آرتیست است؛ کد «اسکن شو» مشتری را بگیر." : "این کد مال فرفرو نیست." });
      return;
    }
    setStep({ state: "busy" });
    try {
      const { ok, payload } = await connectScannedClient(text.trim());
      if (!ok) {
        setStep({ state: "message", text: payload?.error || "وصل شدن انجام نشد." });
        return;
      }
      const { client, alreadyConnected } = payload.data;
      setStep({ state: "done", name: client.name || "مشتری", already: alreadyConnected });
      if (!alreadyConnected) onNotify?.(`${client.name || "مشتری"} وصل شد.`);
    } catch {
      setStep({ state: "message", text: "اتصال برقرار نشد؛ دوباره امتحان کن." });
    }
  }

  const again = <button type="button" className="cnGhostBtn" onClick={() => setStep({ state: "scanning" })}>اسکن بعدی</button>;
  const footer = step.state === "busy"
    ? <div className="cnScanResult"><p role="status">در حال وصل کردن…</p></div>
    : step.state === "message"
      ? <div className="cnScanResult"><p role="alert">{step.text}</p>{again}</div>
      : step.state === "done"
        ? (
          <div className="cnScanResult">
            <p role="status"><b>{step.name}</b> {step.already ? "از قبل وصل بود." : "وصل شد؛ حالا از لیست خودش مستقیم از تو وقت می‌گیرد."}</p>
            {again}
          </div>
        )
        : null;

  return (
    <>
      <button type="button" className="cnScanCustomerBtn" onClick={() => setOpen(true)}>
        <ScanLine size={17} aria-hidden="true" />
        اسکن مشتری
      </button>
      {open ? (
        <QrScanner
          title="اسکن مشتری"
          hint="کد «اسکن شو» مشتری را داخل کادر بگیر"
          paused={step.state !== "scanning"}
          onDetected={handleDetected}
          footer={footer}
          onClose={close}
        />
      ) : null}
    </>
  );
}
