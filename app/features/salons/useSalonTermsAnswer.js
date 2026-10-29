import { useCallback, useRef, useState } from "react";
import { answerSalonCollab } from "../../shared/api/joinTerms";
import { notify } from "../../shared/notice/noticeStore";

/**
 * The salon's answers to an artist's request that carries terms (owner's design 2026-10-28): accept, reject or counter
 * (PATCH /api/salon-collabs with `action`). Kept out of useSalonWorkspace.js; `onChanged(data)` gets the server's fresh
 * { collabs, staff? } so the workspace lists can refresh.
 */
export function useSalonTermsAnswer({ onChanged }) {
  const [busyId, setBusyId] = useState("");
  const [failure, setFailure] = useState({ id: "", text: "" });
  const lock = useRef(false);

  const answer = useCallback(async (request, action, terms) => {
    if (lock.current || !request?.id) return false;
    lock.current = true;
    setBusyId(String(request.id));
    const id = String(request.id);
    setFailure({ id: "", text: "" });
    try {
      const result = await answerSalonCollab({ id: request.id, action, ...(action === "counter" ? { terms } : {}) });
      if (!result.ok) {
        setFailure({ id, text: result.payload?.error || "نشد؛ دوباره بزن." });
        return false;
      }
      const who = request.artistName || "آرتیست";
      notify(action === "accept"
        ? `قبول کردی؛ ${who} اومد توی تیم.`
        : action === "counter" ? `پیشنهادت رفت برای ${who}.` : "پیشنهاد رو نپذیرفتی.");
      onChanged?.(result.data);
      return true;
    } catch {
      setFailure({ id, text: "نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن." });
      return false;
    } finally {
      lock.current = false;
      setBusyId("");
    }
  }, [onChanged]);

  /** The error text for one request's card ("" when it is another card's). */
  const errorFor = (id) => (failure.id === String(id) ? failure.text : "");
  return { busyId, errorFor, clearError: () => setFailure({ id: "", text: "" }), answer };
}
