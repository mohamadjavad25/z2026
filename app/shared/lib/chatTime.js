// SQLite's CURRENT_TIMESTAMP is UTC with a "YYYY-MM-DD HH:MM:SS" shape (no
// timezone marker) — treat it as UTC explicitly, otherwise `new Date(...)`
// parses it as local time and every timestamp is off by the browser's UTC
// offset.
function parseSqliteUtc(value) {
  if (!value) return null;
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "14:05" style clock time, in the viewer's local timezone. */
export function formatChatTime(value) {
  const date = parseSqliteUtc(value);
  if (!date) return "";
  return date.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

/** "امروز" / "دیروز" / a short date, for a day divider between message groups. */
export function formatChatDayLabel(value) {
  const date = parseSqliteUtc(value);
  if (!date) return "";
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "امروز";
  if (diffDays === 1) return "دیروز";
  return date.toLocaleDateString("fa-IR-u-ca-persian", { day: "numeric", month: "long" });
}

/** Calendar-day key (viewer's local timezone) for grouping messages into day buckets. */
export function chatDayKey(value) {
  const date = parseSqliteUtc(value);
  if (!date) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Honest read receipt for a message the current user sent: "read" only if
 * the recipient's (or, for a group, every other member's) last_read_at is
 * at or after this message's createdAt — the same last_read_at column the
 * inbox's unread-badge count already relies on (see
 * app/lib/db/repos/messages.js). There is no separate delivered/read table;
 * every message that made it into the DB counts as "sent" (single check),
 * and this only ever upgrades it to "read" (double check).
 */
export function isMessageRead(message, conversation, myUserId) {
  if (!message || !conversation) return false;
  const createdAt = parseSqliteUtc(message.createdAt);
  if (!createdAt) return false;

  if (conversation.type === "group") {
    const others = (conversation.members || []).filter((m) => m.id !== myUserId);
    if (others.length === 0) return false;
    return others.every((m) => {
      const readAt = parseSqliteUtc(m.lastReadAt);
      return Boolean(readAt && readAt >= createdAt);
    });
  }

  const readAt = parseSqliteUtc(conversation.peer?.lastReadAt);
  return Boolean(readAt && readAt >= createdAt);
}
