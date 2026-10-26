"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bundleServices } from "../../shared/lib/serviceBundle";

export const SERVICE_GONE_MESSAGE = "این خدمت دیگه نیست؛ یه خدمت دیگه انتخاب کن.";

/** What the strip says: «ادامه برای: کوتاهی مو» (several: names joined with « + »; «… با نگار» when booking with someone). */
export const continueText = (names, withName = "") => `ادامه برای: ${names.join(" + ")}${withName ? ` با ${withName}` : ""}`;

/** The chosen team member is no longer on this salon's page (left the team, or the salon removed them). */
export const memberGoneMessage = "اون آرتیست دیگه توی این سالن نیست؛ یه خدمت انتخاب کن تا با یکی دیگه از تیم رزرو کنی.";

/**
 * A guest ticked a service on a public salon page, then signed up (shared/lib/appHandoff keeps the names). Once
 * that salon's page has loaded, this finds the same service(s) in its menu and opens the booking form on them
 * (`openBooking(bundle)`, the same call the services menu makes). The page shows a strip «ادامه برای: …»
 * with «تغییر خدمت» (SalonClientPage). If a service is no longer in the menu the strip says so instead.
 *
 * `begin(salonId, names, staffId)` arms it (`staffId`: the team member chosen with «رزرو با …», the form books with them);
 * nothing else is needed. `salonLoaded` is true once the salon's detail (with its
 * services) is in `selectedSalon`.
 */
export function useContinueService({ selectedSalon, openBooking, getServices }) {
  const [pending, setPending] = useState(null); // { salonId, names, staffId, error }
  const openedRef = useRef(false);
  const salonId = selectedSalon?.id ?? selectedSalon?.source_key;
  const loaded = Boolean(selectedSalon) && selectedSalon.isPublic !== undefined;

  const begin = useCallback((id, names, staffId = 0) => {
    openedRef.current = false;
    setPending(names?.length ? { salonId: String(id), names, staffId: Number(staffId) || 0, error: "" } : null);
  }, []);

  // The member to book with, from the salon page's team (repos/salons/team.js): { staffId, name, bookingName }, null when
  // none was chosen, false when they are no longer there.
  const memberFor = useCallback((staffId) => {
    if (!staffId) return null;
    const member = (selectedSalon?.team || []).find((item) => Number(item.staffId) === Number(staffId));
    return member ? { staffId: member.staffId, name: member.name, bookingName: member.bookingName || member.name } : false;
  }, [selectedSalon]);
  const open = useCallback((found, member) => openBooking(bundleServices(found), member ? { withStaff: member } : undefined), [openBooking]);

  const find = useCallback((names) => {
    const menu = getServices(selectedSalon);
    const found = names.map((name) => menu.find((service) => String(service.name) === name)).filter(Boolean);
    return found.length === names.length ? found : null;
  }, [selectedSalon, getServices]);

  useEffect(() => {
    if (!pending || pending.error || openedRef.current || !loaded || String(salonId) !== pending.salonId) return;
    openedRef.current = true;
    const found = find(pending.names);
    const member = memberFor(pending.staffId);
    if (!found || member === false) {
      setPending((current) => (current ? { ...current, error: found ? memberGoneMessage : SERVICE_GONE_MESSAGE } : current));
      return;
    }
    open(found, member);
  }, [pending, loaded, salonId, find, memberFor, open]);

  const forSalon = pending && String(salonId) === pending.salonId ? pending : null;
  return {
    begin,
    /** Props for the strip on the salon page, or null when nothing is waiting there. */
    strip: forSalon ? { text: forSalon.error ? "" : continueText(forSalon.names, memberFor(forSalon.staffId)?.name || ""), error: forSalon.error } : null,
    onContinue: () => {
      const found = forSalon && find(forSalon.names);
      const member = forSalon ? memberFor(forSalon.staffId) : null;
      if (found && member !== false) open(found, member);
    },
    dismiss: () => setPending(null)
  };
}
