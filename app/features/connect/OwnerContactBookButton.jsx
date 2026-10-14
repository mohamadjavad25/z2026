"use client";

import { useState } from "react";
import { Contact } from "lucide-react";
import { contactPickerSupported, invitePhoneOf, localMobile, pickContact } from "../../shared/lib/contactPicker";

/**
 * «از مخاطبین» for salons and artists (customers page, next to «اسکن کن»): pick a customer from the
 * phone's contacts and book for them, e.g. someone who called and isn't on frfro or isn't there in
 * person. Only the picked contact is read; the phone book never reaches the server. Where the
 * picker doesn't exist (iPhone, desktop) the booking form still opens, to type the name and number.
 */
export function OwnerContactBookButton({ onBook, onNotify, label = "از مخاطبین" }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    if (!contactPickerSupported()) {
      onNotify?.("انتخاب از مخاطبین فقط در کروم اندروید هست؛ نام و شمارهٔ مشتری را بنویس.");
      onBook?.({ name: "", phone: "" });
      return;
    }
    setBusy(true);
    try {
      const picked = await pickContact();
      if (!picked) return;
      onBook?.({ name: picked.name, phone: localMobile(invitePhoneOf(picked.phones)) });
    } catch {
      onNotify?.("باز کردن مخاطبین انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="cnScanCustomerBtn is-contact" onClick={handleClick} disabled={busy}>
      <Contact size={17} aria-hidden="true" />
      {label}
    </button>
  );
}
