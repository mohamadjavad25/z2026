"use client";

import { useEffect, useState } from "react";
import { Check, LogOut, MapPin, QrCode, ScanLine, Store, X } from "lucide-react";
import { Mascot } from "../../components/Mascot";
import { ProfileQrCodeSheet } from "../../components/ProfileQrCodeSheet";
import { usePolling } from "../../shared/lib/usePolling";
import { TermsChips } from "../collab/TermsEditor";
import { ScanFlow } from "../connect/ScanFlow";

function SalonAvatar({ src }) {
  return (
    <span className={`collabAvatar ${src ? "hasImage" : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : <Store size={18} />}
    </span>
  );
}

/** The one card shown for a salon the artist is (or is invited to be) part of. */
function SalonCard({ avatar, name, area, role, terms, tag, children }) {
  return (
    <article className="clConnCard">
      <span className={`clConnTag ${tag === "invite" ? "is-invite" : ""}`}>
        {tag === "invite" ? "دعوت همکاری" : "وصل شدی"}
      </span>
      <div className="clConnWho">
        <SalonAvatar src={avatar} />
        <div>
          <b>{name || "سالن frfro"}</b>
          {area ? <span><MapPin size={12} aria-hidden="true" />{area}</span> : null}
          {role ? <span>{role}</span> : null}
        </div>
      </div>
      <TermsChips days={terms.days} from={terms.from} to={terms.to} share={terms.share} capacity={terms.capacity} />
      {children}
    </article>
  );
}

/**
 * Artist owner — collaboration tab. Not connected: only «اسکن کن» (scan a
 * salon's code to join its team) and «اسکن شو» (show your code so a salon
 * invites you). Connected: only the salon's card; leaving the team brings
 * the two scan buttons back.
 */
export function ArtistCollabBoard({
  artistId,
  artistName = "",
  invites = [],
  teams = [],
  teamBusyId = "",
  inviteRespondBusyId = "",
  onInviteRespond,
  onLeaveTeam,
  onChanged
}) {
  const [sheet, setSheet] = useState(""); // "" | "scan" | "code"
  const connected = teams.length > 0;
  const pendingInvites = invites.filter((item) => item.status === "در انتظار تایید");
  const codeUrl = artistId && typeof window !== "undefined" ? `${window.location.origin}/artists/${artistId}` : "";

  // While the code is on screen, check for the salon's invite so it shows up
  // as soon as they scan; close the code once it (or a team) arrives.
  usePolling(() => onChanged?.(), 5000, sheet === "code" && !connected);
  useEffect(() => {
    if (connected || pendingInvites.length) setSheet("");
  }, [connected, pendingInvites.length]);

  if (connected) {
    return (
      <section className="collabBoard clConnBoard" aria-label="همکاری با سالن">
        {teams.map((team) => (
          <SalonCard
            key={team.staffId || team.salonId}
            avatar={team.salonAvatar}
            name={team.salonName}
            area={team.salonArea}
            role={team.role || "همکار سالن"}
            terms={team}
          >
            <button
              type="button"
              className="clLeaveBtn"
              disabled={String(teamBusyId) === String(team.salonId)}
              onClick={() => onLeaveTeam?.(team.salonId)}
            >
              <LogOut size={13} aria-hidden="true" />
              ترک تیم
            </button>
          </SalonCard>
        ))}
      </section>
    );
  }

  return (
    <section className="collabBoard clConnBoard" aria-label="همکاری با سالن">
      {pendingInvites.map((invite) => {
        const busy = String(inviteRespondBusyId) === String(invite.id);
        return (
          <SalonCard
            key={invite.id}
            tag="invite"
            avatar={invite.salonAvatar}
            name={invite.salonName}
            area={invite.salonArea}
            role={invite.role || invite.artistService || "همکار سالن"}
            terms={invite}
          >
            <div className="clConnActions">
              <button type="button" className="is-decline" disabled={busy} onClick={() => onInviteRespond?.(invite.id, "رد شد")}>
                <X size={15} aria-hidden="true" />
                رد
              </button>
              <button type="button" className="is-accept" disabled={busy} onClick={() => onInviteRespond?.(invite.id, "تایید شد")}>
                <Check size={15} aria-hidden="true" />
                قبول
              </button>
            </div>
          </SalonCard>
        );
      })}

      <div className="cnScanRow">
        <button type="button" className="cnScanBtn is-dark" onClick={() => setSheet("scan")}>
          <span aria-hidden="true"><ScanLine size={20} /></span>
          <span><b>اسکن کن</b><small>کد سالن را اسکن کن</small></span>
        </button>
        <button type="button" className="cnScanBtn" disabled={!codeUrl} onClick={() => setSheet("code")}>
          <span aria-hidden="true"><QrCode size={20} /></span>
          <span><b>اسکن شو</b><small>کدت را به سالن نشان بده</small></span>
        </button>
      </div>

      <Mascot pose="party" size={190} className="clConnMascot" />

      {sheet === "scan" ? (
        <ScanFlow viewerType="artist" onChanged={() => onChanged?.()} onClose={() => setSheet("")} />
      ) : null}
      <ProfileQrCodeSheet
        open={sheet === "code"}
        url={codeUrl}
        name={artistName || "کد من"}
        hint="سالن‌دار این کد را اسکن کند؛ دعوت همکاری همین‌جا برایت می‌آید."
        onOpenChange={(open) => setSheet(open ? "code" : "")}
      />
    </section>
  );
}
