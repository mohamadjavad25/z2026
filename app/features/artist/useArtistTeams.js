import { useState } from "react";
import { getArtistTeams, leaveArtistTeam, respondArtistInvite } from "../../shared/api/artists";
import { exitRefusalOf, openExitDialog } from "../exit/exitDialogBus";

/** The salons' invites to this artist and the teams she is in: answering an invite, leaving a team. Part of useArtistWorkspace. */
export function useArtistTeams({ shellNotify }) {
  const [artistSalonInviteList, setArtistSalonInviteList] = useState([]);
  const [artistTeams, setArtistTeams] = useState([]);
  const [artistTeamBusyId, setArtistTeamBusyId] = useState("");
  const [artistInviteRespondBusyId, setArtistInviteRespondBusyId] = useState("");

  async function respondArtistSalonInvite(inviteId, status) {
    if (!inviteId || artistInviteRespondBusyId) return;
    setArtistInviteRespondBusyId(String(inviteId));
    try {
      const { ok, payload } = await respondArtistInvite({ id: inviteId, status });
      if (!ok) {
        shellNotify(payload.error || "جوابت نرسید؛ دوباره بزن.");
        return false;
      }
      setArtistSalonInviteList(payload.data?.invites || []);
      if (status === "تایید شد") {
        const teamsRes = await getArtistTeams();
        if (teamsRes.ok) setArtistTeams(teamsRes.data?.teams || []);
      }
      shellNotify(status === "تایید شد"
        ? "قبول کردی؛ حالا توی تیم سالنی!"
        : "دعوت رو رد کردی.");
      return true;
    } catch {
      shellNotify("جوابت نرسید؛ دوباره بزن.");
    } finally {
      setArtistInviteRespondBusyId("");
    }
    return false;
  }

  async function leaveArtistSalonTeam(salonUserId) {
    if (!salonUserId || artistTeamBusyId) return;
    if (typeof window !== "undefined" && !window.confirm("از تیم می‌ری بیرون و دیگه توی برنامهٔ سالن نیستی. مطمئنی؟")) return;
    setArtistTeamBusyId(String(salonUserId));
    // One try; a refusal because of confirmed bookings (owner's rules of 2026-10-22) opens the list dialog, whose
    // «ادامه» repeats this same try (with «لغو همهٔ نوبت‌ها» when chosen).
    const attempt = async ({ cancelAll = false } = {}) => {
      const result = await leaveArtistTeam({ salonUserId, ...(cancelAll ? { cancelAll: true } : {}) });
      if (result.ok) {
        setArtistTeams(result.payload.data?.teams || []);
        shellNotify("از تیم اومدی بیرون.");
        return { ok: true };
      }
      const refusal = exitRefusalOf(result);
      if (refusal) return { ok: false, plan: refusal.plan, message: refusal.message, refusal };
      return { ok: false, message: result.payload?.error || "از تیم بیرون نیومدی؛ دوباره بزن." };
    };
    try {
      const result = await attempt();
      if (result.ok) return;
      if (result.refusal) {
        openExitDialog({
          scope: "team",
          params: { salonUserId },
          plan: result.plan,
          message: result.message,
          title: "از تیم بری بیرون؟",
          confirmLabel: "آره، برم بیرون",
          retry: attempt
        });
        return;
      }
      shellNotify(result.message);
    } catch {
      shellNotify("از تیم بیرون نیومدی؛ دوباره بزن.");
    } finally {
      setArtistTeamBusyId("");
    }
  }

  return {
    artistSalonInviteList,
    setArtistSalonInviteList,
    artistTeams,
    setArtistTeams,
    artistTeamBusyId,
    artistInviteRespondBusyId,
    respondArtistSalonInvite,
    leaveArtistSalonTeam
  };
}
