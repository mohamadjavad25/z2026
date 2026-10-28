"use client";

import { useState } from "react";
import { QrScanner } from "../../components/QrScanner";
import { connectScannedClient, connectTo, lookupScannedCode } from "../../shared/api/connections";
import { SalonRulesNote } from "../salons/SalonRulesNote";
import { createSalonInvite } from "../../shared/api/salons";
import { readScannedCode } from "../../shared/lib/connectCodes";
import { ConnectionCard } from "./ConnectionCard";

const TYPE_NAME = { salon: "سالن", artist: "آرتیست" };
const HINTS = {
  client: "QR سالن یا آرتیست رو بگیر توی کادر",
  salon: "کد مشتری یا آرتیست رو بگیر توی کادر",
  artist: "کد مشتری یا سالن رو بگیر توی کادر"
};

/**
 * What the viewer can do with a scanned salon/artist, given how they relate.
 * Returns { label, run } for a button, { note } for a plain status line, or both.
 */
function profileAction(viewerType, profile, relation, joinCode) {
  if (relation === "self") return { note: "این که کد خودته!" };
  if (viewerType === "client") {
    return relation === "connected"
      ? { note: "وصل هستی؛ از همین‌جا نوبت بگیر.", label: "رزرو", kind: "open" }
      : { label: "وصل شو", kind: "connect" };
  }
  if (relation === "unrelated") {
    return { note: `این کد یه ${TYPE_NAME[profile.type]} دیگه‌ست؛ ${TYPE_NAME[viewerType]}ها به هم وصل نمی‌شن.` };
  }
  if (viewerType === "salon") {
    if (relation === "member") return { note: "توی تیمته." };
    if (relation === "invited") return { note: "دعوتش کردی؛ منتظر جواب آرتیسته." };
    return { note: "آرتیست دعوت رو که ببینه، تأیید می‌کنه.", label: "دعوتش کن به تیم", kind: "invite" };
  }
  if (relation === "member") return { note: "توی تیم همین سالنی." };
  // A plain salon profile code proves nothing about who showed it -- only the
  // salon's own dedicated QR/link (with a secret) can join the team instantly.
  // Without it, the artist can send a collaboration proposal from the salon's page (owner's decision 2026-10-25).
  if (!joinCode) {
    return { note: "این کد صفحهٔ سالنه؛ برای اومدن به تیم، پیشنهاد همکاری بفرست تا سالن جواب بده.", label: "پیشنهاد همکاری", kind: "propose" };
  }
  return {
    note: profile.rules ? "با رفتن به تیم، قوانین سالن رو قبول داری." : "می‌ری توی پرسنل این سالن.",
    label: profile.rules ? "قبول دارم، برم توی تیم" : "برم توی تیم",
    kind: "join"
  };
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
        setStep({ state: "message", text: "این کد یه مشتریه؛ کد سالن یا آرتیست رو اسکن کن." });
        return;
      }
      setStep({ state: "busy", text: "دارم مشتری رو وصل می‌کنم…" });
      try {
        const { ok, payload } = await connectScannedClient(String(text).trim());
        if (!ok) {
          setStep({ state: "message", text: payload?.error || "وصل نشد؛ دوباره بزن." });
          return;
        }
        const { client, alreadyConnected } = payload.data;
        const name = client.name || "مشتری";
        setStep({ state: "message", text: alreadyConnected ? `${name} از قبل وصل بود.` : `${name} وصل شد؛ حالا یه‌راست از تو نوبت می‌گیره.` });
        if (!alreadyConnected) onChanged?.("client");
      } catch {
        setStep({ state: "message", text: "وصل نشد؛ دوباره بزن." });
      }
      return;
    }
    setStep({ state: "busy", text: "دارم پیدا می‌کنم…" });
    try {
      const { ok, data, payload } = await lookupScannedCode(String(text).trim());
      if (!ok) {
        setStep({ state: "message", text: payload?.error || "این سالن یا آرتیست پیدا نشد." });
        return;
      }
      setStep({ state: "profile", profile: data.profile, relation: data.relation, joinCode: code.joinCode || "" });
    } catch {
      setStep({ state: "message", text: "وصل نشد؛ دوباره بزن." });
    }
  }

  async function runAction(kind, profile, joinCode) {
    if (kind === "propose") {
      // The salon's public page has the proposal form (BusinessVisitorBar).
      window.location.assign(`/salons/${Number(profile.id)}`);
      return;
    }
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
      if (kind !== "invite") {
        // Joining a team always goes through the salon's terms page, so the artist reads and accepts them first.
        window.location.assign(`/join-salon/${profile.id}?k=${encodeURIComponent(joinCode)}`);
        return;
      }
      const { ok, payload } = await createSalonInvite({ artistUserId: profile.id });
      if (!ok) {
        setStep({ state: "message", text: payload?.error || "نشد؛ دوباره بزن." });
        return;
      }
      setStep({ state: "profile", profile, relation: kind === "invite" ? "invited" : "member" });
      onChanged?.(kind);
    } catch {
      setStep({ state: "message", text: "وصل نشد؛ دوباره بزن." });
    } finally {
      setActing(false);
    }
  }

  const scanAgain = (
    <button type="button" className="cnGhostBtn" onClick={() => setStep({ state: "scanning" })}>دوباره اسکن کن</button>
  );

  let footer = null;
  if (step.state === "busy") {
    footer = <div className="cnScanResult"><p role="status">{step.text}</p></div>;
  } else if (step.state === "message") {
    footer = <div className="cnScanResult"><p role="status">{step.text}</p>{scanAgain}</div>;
  } else if (step.state === "profile") {
    const { profile, relation, joinCode } = step;
    const action = profileAction(viewerType, profile, relation, joinCode);
    footer = (
      <div className="cnScanResult">
        <ConnectionCard
          profile={profile}
          onOpen={viewerType === "client" ? () => runAction("open", profile) : undefined}
          action={action.label ? (
            <button type="button" className="cnPrimaryBtn" disabled={acting} onClick={() => runAction(action.kind, profile, joinCode)}>
              {acting ? "…" : action.label}
            </button>
          ) : null}
        />
        {viewerType === "artist" && profile.type === "salon" && relation !== "member" ? <SalonRulesNote rules={profile.rules} open /> : null}
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
