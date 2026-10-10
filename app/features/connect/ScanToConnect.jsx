"use client";

import { useState } from "react";
import { QrScanner } from "../../components/QrScanner";
import { searchConnections } from "../../shared/api/connections";
import { readScannedCode } from "../../shared/lib/connectCodes";
import { ConnectionCard } from "./ConnectionCard";

const MESSAGES = {
  client: "این کد یک مشتری است، نه سالن یا آرتیست.",
  unknown: "این کد مال فرفرو نیست.",
  missing: "این سالن یا آرتیست پیدا نشد.",
  error: "اتصال برقرار نشد؛ دوباره امتحان کن."
};

/**
 * «اسکن کن» for clients: scan a salon's or artist's QR, see who it is, connect.
 * Props: connect(profile) -> Promise<profile|null>, onOpen(profile), onClose
 */
export function ScanToConnect({ connect, onOpen, onClose }) {
  // { state: "scanning" } | { state: "loading" } | { state: "found", profile } | { state: "message", text }
  const [step, setStep] = useState({ state: "scanning" });
  const [busy, setBusy] = useState(false);

  async function handleDetected(text) {
    const code = readScannedCode(text);
    if (code.kind !== "profile") {
      setStep({ state: "message", text: MESSAGES[code.kind] });
      return;
    }
    setStep({ state: "loading" });
    try {
      const { ok, data } = await searchConnections(text);
      const profile = ok ? data.results?.[0] : null;
      setStep(profile ? { state: "found", profile } : { state: "message", text: MESSAGES.missing });
    } catch {
      setStep({ state: "message", text: MESSAGES.error });
    }
  }

  async function handleConnect(profile) {
    setBusy(true);
    const connected = await connect(profile);
    setBusy(false);
    if (connected) setStep({ state: "found", profile: { ...connected, connected: true } });
  }

  const scanAgain = (
    <button type="button" className="cnGhostBtn" onClick={() => setStep({ state: "scanning" })}>اسکن دوباره</button>
  );

  let footer = null;
  if (step.state === "loading") {
    footer = <div className="cnScanResult"><p role="status">در حال پیدا کردن…</p></div>;
  } else if (step.state === "message") {
    footer = <div className="cnScanResult"><p role="alert">{step.text}</p>{scanAgain}</div>;
  } else if (step.state === "found") {
    const { profile } = step;
    footer = (
      <div className="cnScanResult">
        <ConnectionCard
          profile={profile}
          onOpen={(item) => { onClose?.(); onOpen?.(item); }}
          action={profile.connected ? (
            <button type="button" className="cnPrimaryBtn" onClick={() => { onClose?.(); onOpen?.(profile); }}>رزرو</button>
          ) : (
            <button type="button" className="cnPrimaryBtn" disabled={busy} onClick={() => handleConnect(profile)}>
              {busy ? "…" : "وصل شو"}
            </button>
          )}
        />
        {scanAgain}
      </div>
    );
  }

  return (
    <QrScanner
      title="اسکن کن"
      hint="کد QR سالن یا آرتیست را داخل کادر بگیر"
      paused={step.state !== "scanning"}
      onDetected={handleDetected}
      footer={footer}
      onClose={onClose}
    />
  );
}
