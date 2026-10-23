"use client";

import { useEffect, useState } from "react";
import { ContactRound, ScanLine, Search } from "lucide-react";
import { contactPickerSupported, pickContact } from "../../shared/lib/contactPicker";
import { ConnectSheet } from "../connect/ConnectSheet";
import { ContactLookup } from "../connect/ContactLookup";
import { ScanFlow } from "../connect/ScanFlow";
import { useConnections } from "../connect/useConnections";

/**
 * The ways to bring a salon or artist into «سالن و آرتیست من», shortest first:
 *  1. «از مخاطبین» — pick them from the phone's contacts; if they aren't on frfro yet, an invite SMS is
 *     one tap away (ContactLookup). Only where the phone has a contact picker.
 *  2. «اسکن QR» — they are right there (the QR on the counter or the artist's profile): connected at once.
 *  3. «جستجو» — otherwise the «رزرو» tab, where the client searches by name, phone or link.
 *
 * Props:
 *  - clientName: used in the invite text
 *  - onConnected(profile): after a connect, so the list refreshes
 *  - onOpenPlace(profile): book with a place that was just connected or already was
 *  - onFindPlaces(): the «رزرو» tab
 *  - onNotify(message)
 *  - onDone(): called when one of the flows opens a place, so a wrapping sheet can close
 */
export function AddPlaceActions({ clientName = "", onConnected, onOpenPlace, onFindPlaces, onNotify, onDone }) {
  const { connect, connectingId } = useConnections({ onNotify, load: false });
  const [sheet, setSheet] = useState(""); // "" | "scan"
  const [contact, setContact] = useState(null); // the picked contact, while its sheet is open
  const [hasPicker, setHasPicker] = useState(false);

  useEffect(() => { setHasPicker(contactPickerSupported()); }, []);

  // The system's own picker asks for access and hands over only the chosen contact.
  async function chooseContact() {
    try {
      const picked = await pickContact();
      if (picked) setContact(picked);
    } catch {
      onNotify?.("به مخاطب‌هات دسترسی نداریم؛ از «جستجو» پیداش کن.");
    }
  }

  async function connectAndSync(profile, options) {
    const connected = await connect(profile, options);
    if (connected) onConnected?.(connected);
    return connected;
  }

  return (
    <div className="chAdd">
      <div className="chAddBtns">
        {hasPicker ? (
          <button type="button" className="chAddBtn is-primary" onClick={chooseContact}>
            <ContactRound size={20} aria-hidden="true" />
            از مخاطبین
          </button>
        ) : null}
        <button type="button" className={`chAddBtn${hasPicker ? "" : " is-primary"}`} onClick={() => setSheet("scan")}>
          <ScanLine size={20} aria-hidden="true" />
          اسکن QR
        </button>
      </div>
      <button type="button" className="chAddLink" onClick={() => { onDone?.(); onFindPlaces?.(); }}>
        <Search size={15} aria-hidden="true" />
        اینجا نیستن؟ توی «نوبت» جستجو کن
      </button>

      {contact ? (
        <ConnectSheet label="مخاطب انتخاب‌شده" title={contact.name || "مخاطب انتخاب‌شده"} subtitle="داریم توی فرفرو پیداش می‌کنیم." onClose={() => setContact(null)}>
          <ContactLookup
            contact={contact}
            clientName={clientName}
            connectingId={connectingId}
            onConnect={async (profile) => {
              const connected = await connectAndSync(profile, { silent: true });
              if (!connected) return;
              setContact(null);
              onDone?.();
              onOpenPlace?.(connected);
            }}
            onOpen={(profile) => {
              setContact(null);
              onDone?.();
              onOpenPlace?.(profile);
            }}
          />
        </ConnectSheet>
      ) : null}
      {sheet === "scan" ? (
        <ScanFlow
          viewerType="client"
          connect={connectAndSync}
          onOpenProfile={(profile) => { onDone?.(); onOpenPlace?.(profile); }}
          onClose={() => setSheet("")}
        />
      ) : null}
    </div>
  );
}
