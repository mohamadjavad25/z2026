"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bundleServices } from "../../shared/lib/serviceBundle";

export const SERVICE_GONE_MESSAGE = "این خدمت دیگه نیست؛ یه خدمت دیگه انتخاب کن.";

/** What the strip says: «ادامه برای: کوتاهی مو» (several: names joined with « + »). */
export const continueText = (names) => `ادامه برای: ${names.join(" + ")}`;

/**
 * A guest ticked a service on a public salon page, then signed up (shared/lib/appHandoff keeps the names). Once
 * that salon's page has loaded, this finds the same service(s) in its menu and opens the booking form on them
 * (`openBooking(bundle)`, the same call the services menu makes). The page shows a strip «ادامه برای: …»
 * with «تغییر خدمت» (SalonClientPage). If a service is no longer in the menu the strip says so instead.
 *
 * `begin(salonId, names)` arms it; nothing else is needed. `salonLoaded` is true once the salon's detail (with its
 * services) is in `selectedSalon`.
 */
export function useContinueService({ selectedSalon, openBooking, getServices }) {
  const [pending, setPending] = useState(null); // { salonId, names, error }
  const openedRef = useRef(false);
  const salonId = selectedSalon?.id ?? selectedSalon?.source_key;
  const loaded = Boolean(selectedSalon) && selectedSalon.isPublic !== undefined;

  const begin = useCallback((id, names) => {
    openedRef.current = false;
    setPending(names?.length ? { salonId: String(id), names, error: "" } : null);
  }, []);

  const find = useCallback((names) => {
    const menu = getServices(selectedSalon);
    const found = names.map((name) => menu.find((service) => String(service.name) === name)).filter(Boolean);
    return found.length === names.length ? found : null;
  }, [selectedSalon, getServices]);

  useEffect(() => {
    if (!pending || pending.error || openedRef.current || !loaded || String(salonId) !== pending.salonId) return;
    openedRef.current = true;
    const found = find(pending.names);
    if (!found) {
      setPending((current) => (current ? { ...current, error: SERVICE_GONE_MESSAGE } : current));
      return;
    }
    openBooking(bundleServices(found));
  }, [pending, loaded, salonId, find, openBooking]);

  const forSalon = pending && String(salonId) === pending.salonId ? pending : null;
  return {
    begin,
    /** Props for the strip on the salon page, or null when nothing is waiting there. */
    strip: forSalon ? { text: forSalon.error ? "" : continueText(forSalon.names), error: forSalon.error } : null,
    onContinue: () => { const found = forSalon && find(forSalon.names); if (found) openBooking(bundleServices(found)); },
    dismiss: () => setPending(null)
  };
}
