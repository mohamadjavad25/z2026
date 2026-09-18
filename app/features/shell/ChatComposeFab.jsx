"use client";

import { UsersRound } from "lucide-react";

/**
 * Floats above the bottom nav, chat-inbox pane only (HomeApp hides it the
 * moment the pane leaves "inbox" — a conversation, group details, etc.).
 *
 * Honest scope: this starts a GROUP chat from people you already have a
 * direct conversation with. It is NOT "add a contact" / "browse users" —
 * this app deliberately has no open user directory (avoids spam/abuse).
 * A brand-new 1:1 conversation always starts from a salon/artist/shop's own
 * page (its message button, a booking, etc.), never from the chat tab.
 * The label/aria-label below spell that out so the button doesn't read as
 * a bare, unexplained "+".
 */
export function ChatComposeFab({ open = false, onClick }) {
  if (!open) return null;

  return (
    <button
      type="button"
      className="chatComposeFab"
      onClick={onClick}
      aria-label="گروه گفتگوی جدید از مخاطبانی که قبلاً با آن‌ها گفتگوی مستقیم داشته‌ای"
      title="گروه جدید از مخاطبان فعلی"
    >
      <UsersRound size={19} />
      <span>گروه جدید</span>
    </button>
  );
}
