import { all, get, getDb, run } from "../connection.js";
import { DUE_CUSTOM_MAX, DUE_GAP_CHOICES, usualGapDays } from "../../../shared/lib/dueReminder.js";

/**
 * «وقتش شده» rules of one salon or artist (owner's decisions of 2026-10-25, migration 051). A service without a
 * stored rule uses frfro's usual gap and the first ready text; nothing is sent for the place until it confirms.
 */

async function serviceNames(db, ownerUserId, type) {
  const rows = type === "artist"
    ? await all(db, "SELECT name FROM artist_services WHERE user_id = $1 ORDER BY id", [ownerUserId])
    : await all(db, "SELECT name FROM salon_services WHERE salon_user_id = $1 ORDER BY id", [ownerUserId]);
  return [...new Set(rows.map((row) => String(row.name || "").trim()).filter(Boolean))];
}

const ruleView = (name, row) => ({
  name,
  usualGap: usualGapDays(name),
  gapDays: row ? Number(row.gap_days) || 0 : usualGapDays(name),
  textId: row?.text_id || "a",
  customText: row?.custom_text || "",
  changed: Boolean(row)
});

/** { confirmed, services: [{ name, usualGap, gapDays, textId, customText, changed }] } */
export async function getDuePlan(ownerUserId, type) {
  const db = await getDb();
  const owner = await get(db, "SELECT due_confirmed_at FROM users WHERE id = $1", [ownerUserId]);
  const names = await serviceNames(db, ownerUserId, type);
  const rows = await all(db, "SELECT * FROM due_reminder_rules WHERE owner_user_id = $1", [ownerUserId]);
  const byName = new Map(rows.map((row) => [row.service, row]));
  return { confirmed: Boolean(owner?.due_confirmed_at), services: names.map((name) => ruleView(name, byName.get(name))) };
}

/** «همه درسته»: the place agrees to the gaps as they are. */
export async function confirmDuePlan(ownerUserId) {
  const db = await getDb();
  await run(db, "UPDATE users SET due_confirmed_at = COALESCE(due_confirmed_at, NOW()) WHERE id = $1", [ownerUserId]);
}

/** One service's gap and text; saving it also counts as the place's confirmation. Returns null for a bad value. */
export async function saveDueRule(ownerUserId, type, { service, gapDays, textId, customText }) {
  const db = await getDb();
  const name = String(service || "").trim();
  if (!(await serviceNames(db, ownerUserId, type)).includes(name)) return { ok: false, error: "این خدمت توی منوت نیست." };
  const gap = Number(gapDays);
  if (!DUE_GAP_CHOICES.includes(gap)) return { ok: false, error: "یکی از فاصله‌های فهرست رو انتخاب کن." };
  const text = ["a", "b", "c", "custom"].includes(textId) ? textId : "a";
  const custom = String(customText || "").trim();
  if (text === "custom" && !custom) return { ok: false, error: "متنت رو بنویس یا یکی از متن‌های آماده رو انتخاب کن." };
  if (custom.length > DUE_CUSTOM_MAX) return { ok: false, error: "متن حداکثر ۸۰ حرف باشه." };
  await run(db, `
    INSERT INTO due_reminder_rules (owner_user_id, service, gap_days, text_id, custom_text, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (owner_user_id, service) DO UPDATE SET gap_days = excluded.gap_days, text_id = excluded.text_id,
      custom_text = excluded.custom_text, updated_at = NOW()
  `, [ownerUserId, name, gap, text, text === "custom" ? custom : ""]);
  await confirmDuePlan(ownerUserId);
  return { ok: true };
}

/** The rule the sweep uses for one service of a place: { gapDays, textId, customText }. */
export async function dueRuleFor(db, ownerUserId, service) {
  const row = await get(db, "SELECT * FROM due_reminder_rules WHERE owner_user_id = $1 AND service = $2", [ownerUserId, service]);
  const view = ruleView(service, row);
  return { gapDays: view.gapDays, textId: view.textId, customText: view.customText };
}
