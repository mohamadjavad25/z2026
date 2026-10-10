"use client";

import { useState } from "react";
import { QrScanner } from "../../components/QrScanner";
import { connectScannedClient, connectTo, joinSalonTeam, lookupScannedCode } from "../../shared/api/connections";
import { createSalonInvite } from "../../shared/api/salons";
import { readScannedCode } from "../../shared/lib/connectCodes";
import { ConnectionCard } from "./ConnectionCard";

const TYPE_NAME = { salon: "سالن", artist: "آرتیست" };
const HINTS = {
  client: "کد QR سالن یا آرتیست را داخل کادر بگیر",
  salon: "کد مشتری یا آرتیست را داخل کادر بگیر",
  artist: "کد مشتری یا سالن را داخل کادر بگیر"
};

/**
 * What the viewer can do with a scanned salon/artist, given how they relate.
 * Returns { label, run } for a button, { note } for a plain status line, or both.
 */
function profileAction(viewerType, profile, relation) {
  if (relation === "self") return { note: "این کد خودت است." };
  if (viewerType === "client") {
    return relation === "connected"
      ? { note: "وصل هستی؛ از همین‌جا وقت بگیر.", label: "رزرو", kind: "open" }
      : { label: "وصل شو", kind: "connect" };
  }
  if (relation === "unrelated") {
    return { note: `این کد یک ${TYPE_NAME[profile.type]} دیگر است؛ ${TYPE_NAME[viewerType]}ها به هم وصل نمی‌شوند.` };
  }
  if (viewerType === "salon") {
    if (relation === "member") return { note: "عضو تیم توست." };
    if (relation === "invited") return { note: "دعوت فرستاده شده؛ منتظر پاسخ آرتیست." };
    return { note: "آرتیست بعد از دیدن دعوت تأیید می‌کند.", label: "دعوت به تیم", kind: "invite" };
  }
  if (relation === "member") return { note: "عضو تیم این سالن هستی." };
  return { note: "با پیوستن، در پرسنل این سالن قرار می‌گیری.", label: "پیوستن به تیم", kind: "join" };
}

/**
 * The one QR scanner for everyone. It reads the code and offers what makes
 * sense for whoever is scanning:
 *  - client scans a salon/artist          -> connect («سالن و آرتیست من»)
 *  - salon/artist scans a client's code   -> the client is connected to them
 *  - salon scans an artist                -> invite to the team (artist accepts)
 *  - artist scans a salon                 -> join the team (the existing QR join)
 *
 * Props:
 *  - viewerType: "client" | "salon" | "artist"
 *  - connect(profile): optional, the client page's own connect (keeps its list in sync)
 *  - onOpenProfile(profile): client only, open the salon/artist page
 *  - onChanged(kind): after a team join/invite or a client connect, to refresh data
 *  - onClose
 * Results are shown in the scanner itself, so no toast is raised while it is open.
 */
export function ScanFlow({ viewerType, connect, onOpenProfile, onChanged, onClose }) {
  // { state: "scanning" } | { state: "busy", text } | { state: "profile", profile, relation } | { state: "message", text }
  const [step, setStep] = useState({ state: "scanning" });
  const [acting, setActing] = useState(false);

  async function handleDetected(text) {
    const code = readScannedCode(text);
    if (code.kind === "unknown") {
      setStep({ state: "message", text: "این کد مال فرفرو نیست." });
      return;
    }
    if (code.kind === "client") {
      if (viewerType === "client") {
        setStep({ state: "message", text: "این کد یک مشتری است؛ کد سالن یا آرتیست را اسکن کن." });
        return;
      }
      setStep({ state: "busy", text: "در حال وصل کردن مشتری…" });
      try {
        const { ok, payload } = await connectScannedClient(String(text).trim());
        if (!ok) {
          setStep({ state: "message", text: payload?.error || "وصل شدن انجام نشد." });
          return;
        }
        const { client, alreadyConnected } = payload.data;
        const name = client.name || "مشتری";
        setStep({ state: "message", text: alreadyConnected ? `${name} از قبل وصل بود.` : `${name} وصل شد؛ حالا از لیست خودش مستقیم از تو وقت می‌گیرد.` });
        if (!alreadyConnected) onChanged?.("client");
      } catch {
        setStep({ state: "message", text: "اتصال برقرار نشد؛ دوباره امتحان کن." });
      }
      return;
    }
    setStep({ state: "busy", text: "در حال پیدا کردن…" });
    try {
      const { ok, data, payload } = await lookupScannedCode(String(text).trim());
      if (!ok) {
        setStep({ state: "message", text: payload?.error || "این سالن یا آرتیست پیدا نشد." });
        return;
      }
      setStep({ state: "profile", profile: data.profile, relation: data.relation });
    } catch {
      setStep({ state: "message", text: "اتصال برقرار نشد؛ دوباره امتحان کن." });
    }
  }

  async function runAction(kind, profile) {
    if (kind === "open") {
      onClose?.();
      onOpenProfile?.(profile);
      return;
    }
    setActing(true);
    try {
      if (kind === "connect") {
        const connected = connect
          ? await connect(profile, { silent: true })
          : await connectTo(profile.id).then(({ ok, payload }) => (ok ? payload.data.profile : null));
        if (connected) setStep({ state: "profile", profile, relation: "connected" });
        return;
      }
      const { ok, payload } = kind === "invite"
        ? await createSalonInvite({ artistUserId: profile.id })
        : await joinSalonTeam(profile.id);
      if (!ok) {
        setStep({ state: "message", text: payload?.error || "انجام نشد؛ دوباره امتحان کن." });
        return;
      }
      setStep({ state: "profile", profile, relation: kind === "invite" ? "invited" : "member" });
      onChanged?.(kind);
    } catch {
      setStep({ state: "message", text: "اتصال برقرار نشد؛ دوباره امتحان کن." });
    } finally {
      setActing(false);
    }
  }

  const scanAgain = (
    <button type="button" className="cnGhostBtn" onClick={() => setStep({ state: "scanning" })}>اسکن دوباره</button>
  );

  let footer = null;
  if (step.state === "busy") {
    footer = <div className="cnScanResult"><p role="status">{step.text}</p></div>;
  } else if (step.state === "message") {
    footer = <div className="cnScanResult"><p role="status">{step.text}</p>{scanAgain}</div>;
  } else if (step.state === "profile") {
    const { profile, relation } = step;
    const action = profileAction(viewerType, profile, relation);
    footer = (
      <div className="cnScanResult">
        <ConnectionCard
          profile={profile}
          onOpen={viewerType === "client" ? () => runAction("open", profile) : undefined}
          action={action.label ? (
            <button type="button" className="cnPrimaryBtn" disabled={acting} onClick={() => runAction(action.kind, profile)}>
              {acting ? "…" : action.label}
            </button>
          ) : null}
        />
        {action.note ? <p className="cnScanNote" role="status">{action.note}</p> : null}
        {scanAgain}
      </div>
    );
  }

  return (
    <QrScanner
      title="اسکن کن"
      hint={HINTS[viewerType] || HINTS.client}
      paused={step.state !== "scanning"}
      onDetected={handleDetected}
      footer={footer}
      onClose={onClose}
    />
  );
}
