"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { SalonClientBookingModal } from "./SalonClientBookingModal";
import { getBookableSalonServiceItems } from "./useSalonDirectory";
import { createSalonBooking } from "../../shared/api/salons";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { toPersianDigits } from "../../shared/lib/digits";

const NOT_A_CLIENT = "با حساب سالن یا آرتیست نمی‌شه نوبت گرفت؛ با حساب مشتری وارد شو.";
const CANCELLED = "حساب نساختی، برای همین درخواست نرفت. هر وقت خواستی دوباره «بفرست» رو بزن.";

/**
 * Booking from a salon's public page without signing in first (owner's decision of 2026-11-02, for visitors from an
 * Instagram story): the visitor picks the services, day and time in the usual form; «بفرست» opens the account sheet
 * (`gate`, from useFollowGate) and the request goes the moment they are in. The form stays open underneath, so nothing
 * is picked again; a time taken meanwhile comes back as the form's own «این ساعت همین الان پر شد» with the next one.
 * A signed-in client sends straight away. The request waits for the salon's answer as always.
 */
export function usePublicSalonBooking(salon, gate) {
  const [booking, setBooking] = useState(null);
  const [sent, setSent] = useState(null);
  const sendingRef = useRef(false);

  const open = (picked = null, options = {}) => {
    const items = getBookableSalonServiceItems(salon);
    const service = picked?.name || items[0]?.name || "";
    if (!service) return false;
    setBooking({ open: true, service, bundle: picked?.items ? picked : null, withStaff: options?.withStaff || null, client: "", phone: "" });
    return true;
  };

  const send = async (body) => {
    if (sendingRef.current) return { ok: false, status: 400, payload: { error: "درخواستت داره می‌ره؛ یه لحظه صبر کن." } };
    sendingRef.current = true;
    try {
      const result = await createSalonBooking({ ...body, salonUserId: salon.id, status: "درخواست" });
      if (result.ok) {
        const made = result.payload?.data?.booking || {};
        setBooking(null);
        setSent({ service: made.service || body.service, day: made.booking_date || body.bookingDate, time: made.time || body.time });
      }
      return result;
    } catch {
      return { ok: false, status: 0, payload: { error: "وصل نشد؛ دوباره بزن." } };
    } finally {
      sendingRef.current = false;
    }
  };

  const onSubmit = (body) => {
    const viewer = gate.viewer;
    // Still checking whether they are signed in (a slow network): never ask a signed-in client to sign up again.
    if (viewer === undefined) return Promise.resolve({ ok: false, status: 400, payload: { error: "یه لحظه صبر کن و دوباره «بفرست» رو بزن." } });
    if (viewer && viewer.type !== "client") return Promise.resolve({ ok: false, status: 403, payload: { error: NOT_A_CLIENT } });
    if (viewer) return send(body);
    return new Promise((resolve) => {
      gate.askAccount("book", {
        onReady: async (user) => {
          if (user?.type && user.type !== "client") resolve({ ok: false, status: 403, payload: { error: NOT_A_CLIENT } });
          else resolve(await send(body));
          return "";
        },
        onCancel: () => resolve({ ok: false, status: 400, payload: { error: CANCELLED } })
      });
    });
  };

  return { booking, sent, open, onSubmit, close: () => setBooking(null), closeSent: () => setSent(null) };
}

export function PublicSalonBookingSheets({ salon, flow, guest }) {
  const sent = flow.sent;
  return (
    <>
      {flow.booking ? (
        <SalonClientBookingModal
          open
          guest={guest}
          salon={salon}
          booking={flow.booking}
          onClose={flow.close}
          onSubmit={flow.onSubmit}
        />
      ) : null}
      <ProfileSheet open={Boolean(sent)} kicker="انجام شد" title="درخواستت رفت" panelClassName="fsSheet" onClose={flow.closeSent}>
        {sent ? (
          <div className="fsDone" role="status">
            <span className="fsDoneMark" aria-hidden="true"><Check size={34} strokeWidth={3} /></span>
            <h3>{sent.service} · {formatRelativeBookingDayLabel(sent.day)} ساعت {toPersianDigits(String(sent.time || "").slice(0, 5))}</h3>
            <p>«{salon.name}» باید تأییدش کنه. جوابش که اومد، توی فرفرو بهت خبر می‌دیم.</p>
            <div className="fsDoneActions">
              <a className="fsSubmit" href="/">برو به فرفرو</a>
              <button type="button" className="fsGhost" onClick={flow.closeSent}>صفحه رو ببینم</button>
            </div>
          </div>
        ) : null}
      </ProfileSheet>
    </>
  );
}
