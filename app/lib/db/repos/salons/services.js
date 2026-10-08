import { getDb, all, get, run } from "../../connection.js";
import { listSalonStaff } from "./staff.js";
import { normalizeServiceEmoji } from "../serviceEmoji.js";
import { resolveServiceStaff, splitServiceStaffChoice } from "../../../../shared/lib/serviceSkills.js";

let exclusionsReady;
/** staff_excluded_ids (migration 028), also added on first use so the feature works before the migration is run. */
function ensureExclusionsColumn() {
  exclusionsReady ??= (async () => {
    const db = await getDb();
    await run(db, "ALTER TABLE salon_services ADD COLUMN IF NOT EXISTS staff_excluded_ids TEXT NOT NULL DEFAULT ''");
  })().catch((error) => {
    exclusionsReady = undefined;
    throw error;
  });
  return exclusionsReady;
}

function storedIds(value) {
  return String(value || "").split(",").map((id) => id.trim()).filter(Boolean);
}

/**
 * A service row as clients see it: `staff_ids` / `staff_members` are the artists who actually do it
 * (skill match + hand-added − hand-removed), and the parts are exposed for the services tab.
 */
function withServiceStaff(service, staff) {
  const manual = storedIds(service.staff_ids);
  // Rows saved before artists were matched automatically kept their single pick only in staff_id.
  if (!manual.length && service.staff_id) manual.push(String(service.staff_id));
  const excluded = storedIds(service.staff_excluded_ids);
  const { effective, auto } = resolveServiceStaff(service, staff, { manual, excluded });
  const members = effective.map((id) => staff.find((person) => String(person.id) === id)).filter(Boolean);
  return {
    ...service,
    staff_id: members[0]?.id ?? null,
    staff_name: members[0]?.name || "",
    staff_role: members[0]?.role || "",
    staff_ids: effective,
    staff_members: members,
    staff_names: members.map((person) => person.name).filter(Boolean).join("، "),
    staff_auto_ids: auto,
    staff_manual_ids: manual,
    staff_excluded_ids: excluded
  };
}

export async function listSalonServices(salonUserId, runner = null) {
  await ensureExclusionsColumn();
  const db = runner || (await getDb());
  const staff = await listSalonStaff(salonUserId, db);
  const rows = await all(db, "SELECT * FROM salon_services WHERE salon_user_id = $1 ORDER BY id", [salonUserId]);
  return rows.map((service) => withServiceStaff(service, staff));
}

async function getSalonServiceWithStaff(id, salonUserId, db) {
  const staff = await listSalonStaff(salonUserId, db);
  const row = await get(db, "SELECT * FROM salon_services WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  return row ? withServiceStaff(row, staff) : null;
}

export async function addSalonService(salonUserId, data) {
  await ensureExclusionsColumn();
  const db = await getDb();
  const staffId = data.staff_id == null || data.staff_id === "" ? null : Number(data.staff_id);
  // A new service starts with everyone whose skills match it; any ids sent are extra hand-picked ones.
  const staffIds = Array.isArray(data.staff_ids)
    ? data.staff_ids.map((id) => String(id)).filter(Boolean).join(",")
    : String(data.staff_ids || "");
  const info = await run(db, `
    INSERT INTO salon_services (salon_user_id, name, price, duration, hint, staff_id, staff_ids, emoji) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [
    salonUserId,
    data.name || "",
    data.price || "",
    data.duration || "",
    data.hint || "",
    Number.isFinite(staffId) ? staffId : null,
    staffIds,
    normalizeServiceEmoji(data.emoji)
  ]);
  return getSalonServiceWithStaff(Number(info.rows[0].id), salonUserId, db);
}

export async function updateSalonService(id, salonUserId, data) {
  await ensureExclusionsColumn();
  const db = await getDb();
  const current = await get(db, "SELECT * FROM salon_services WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  if (!current) return null;

  let nextStaffId = current.staff_id;
  if (Object.prototype.hasOwnProperty.call(data, "staff_id")) {
    if (data.staff_id == null || data.staff_id === "") nextStaffId = null;
    else {
      const parsed = Number(data.staff_id);
      nextStaffId = Number.isFinite(parsed) ? parsed : null;
    }
  }
  let nextStaffIds = current.staff_ids || "";
  let nextExcludedIds = current.staff_excluded_ids || "";
  if (Object.prototype.hasOwnProperty.call(data, "staff_ids")) {
    // The client sends the full list it wants; store it as hand-added / hand-removed relative to the
    // automatic skill match, so artists who join later and match are still picked up.
    const staff = await listSalonStaff(salonUserId, db);
    const nextService = {
      ...current,
      name: data.name ?? current.name,
      emoji: Object.prototype.hasOwnProperty.call(data, "emoji") ? normalizeServiceEmoji(data.emoji) : current.emoji
    };
    const { manual, excluded } = splitServiceStaffChoice(nextService, staff, data.staff_ids);
    nextStaffIds = manual.join(",");
    nextExcludedIds = excluded.join(",");
    const firstWanted = (Array.isArray(data.staff_ids) ? data.staff_ids : storedIds(data.staff_ids))[0];
    nextStaffId = firstWanted != null && firstWanted !== "" && Number.isFinite(Number(firstWanted)) ? Number(firstWanted) : null;
  }

  await run(db, `
    UPDATE salon_services SET name = $1, price = $2, duration = $3, hint = $4, staff_id = $5, staff_ids = $6, emoji = $7, staff_excluded_ids = $10 WHERE id = $8 AND salon_user_id = $9
  `, [
    data.name ?? current.name,
    data.price ?? current.price,
    data.duration ?? current.duration,
    Object.prototype.hasOwnProperty.call(data, "hint") ? (data.hint || "") : current.hint,
    nextStaffId,
    nextStaffIds,
    Object.prototype.hasOwnProperty.call(data, "emoji") ? normalizeServiceEmoji(data.emoji) : current.emoji,
    id,
    salonUserId,
    nextExcludedIds
  ]);
  return getSalonServiceWithStaff(id, salonUserId, db);
}

export async function deleteSalonService(id, salonUserId) {
  const db = await getDb();
  const result = await run(db, "DELETE FROM salon_services WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  return result.rowCount > 0;
}
