import { getDb, all, get, run } from "../../connection.js";
import { listSalonStaff } from "./staff.js";
import { normalizeServiceEmoji } from "../serviceEmoji.js";

export async function listSalonServices(salonUserId, runner = null) {
  const db = runner || (await getDb());
  const staff = await listSalonStaff(salonUserId, db);
  const rows = await all(db, `
    SELECT
      s.*,
      st.name AS staff_name,
      st.role AS staff_role
    FROM salon_services s
    LEFT JOIN salon_staff st
      ON st.id = s.staff_id AND st.salon_user_id = s.salon_user_id
    WHERE s.salon_user_id = $1
    ORDER BY s.id
  `, [salonUserId]);
  return rows.map((service) => {
    const staffIds = String(service.staff_ids || "").trim()
      ? String(service.staff_ids).split(",").map((id) => id.trim()).filter(Boolean)
      : service.staff_id
        ? [String(service.staff_id)]
        : [];
    const staffMembers = staff.filter((person) => staffIds.includes(String(person.id)));
    return {
      ...service,
      // The column is a comma string; clients get the parsed list.
      staff_ids: staffIds,
      staff_members: staffMembers,
      staff_names: staffMembers.map((person) => person.name).filter(Boolean).join("، ")
    };
  });
}

async function getSalonServiceRow(id, runner = null) {
  const db = runner || (await getDb());
  return get(db, `
    SELECT
      s.*,
      st.name AS staff_name,
      st.role AS staff_role
    FROM salon_services s
    LEFT JOIN salon_staff st
      ON st.id = s.staff_id AND st.salon_user_id = s.salon_user_id
    WHERE s.id = $1
  `, [id]);
}

export async function addSalonService(salonUserId, data) {
  const db = await getDb();
  const staffId = data.staff_id == null || data.staff_id === "" ? null : Number(data.staff_id);
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
  return getSalonServiceRow(Number(info.rows[0].id), db);
}

export async function updateSalonService(id, salonUserId, data) {
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
  if (Object.prototype.hasOwnProperty.call(data, "staff_ids")) {
    nextStaffIds = Array.isArray(data.staff_ids)
      ? data.staff_ids.map((staffId) => String(staffId)).filter(Boolean).join(",")
      : String(data.staff_ids || "");
  }

  await run(db, `
    UPDATE salon_services SET name = $1, price = $2, duration = $3, hint = $4, staff_id = $5, staff_ids = $6, emoji = $7 WHERE id = $8 AND salon_user_id = $9
  `, [
    data.name ?? current.name,
    data.price ?? current.price,
    data.duration ?? current.duration,
    Object.prototype.hasOwnProperty.call(data, "hint") ? (data.hint || "") : current.hint,
    nextStaffId,
    nextStaffIds,
    Object.prototype.hasOwnProperty.call(data, "emoji") ? normalizeServiceEmoji(data.emoji) : current.emoji,
    id,
    salonUserId
  ]);
  return getSalonServiceRow(id, db);
}

export async function deleteSalonService(id, salonUserId) {
  const db = await getDb();
  const result = await run(db, "DELETE FROM salon_services WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  return result.rowCount > 0;
}
