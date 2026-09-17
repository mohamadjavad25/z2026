import { getDb } from "../../connection.js";
import { listSalonStaff } from "./staff.js";
export function listSalonServices(salonUserId) {
  const staff = listSalonStaff(salonUserId);
  return getDb().prepare(`
    SELECT
      s.*,
      st.name AS staff_name,
      st.role AS staff_role
    FROM salon_services s
    LEFT JOIN salon_staff st
      ON st.id = s.staff_id AND st.salon_user_id = s.salon_user_id
    WHERE s.salon_user_id = ?
    ORDER BY s.id
  `).all(salonUserId).map((service) => {
    const staffIds = String(service.staff_ids || "").trim()
      ? String(service.staff_ids).split(",").map((id) => id.trim()).filter(Boolean)
      : service.staff_id
        ? [String(service.staff_id)]
        : [];
    const staffMembers = staff.filter((person) => staffIds.includes(String(person.id)));
    return {
      ...service,
      staff_members: staffMembers,
      staff_names: staffMembers.map((person) => person.name).filter(Boolean).join("، ")
    };
  });
}

function getSalonServiceRow(id) {
  return getDb().prepare(`
    SELECT
      s.*,
      st.name AS staff_name,
      st.role AS staff_role
    FROM salon_services s
    LEFT JOIN salon_staff st
      ON st.id = s.staff_id AND st.salon_user_id = s.salon_user_id
    WHERE s.id = ?
  `).get(id);
}

export function addSalonService(salonUserId, data) {
  const staffId = data.staff_id == null || data.staff_id === "" ? null : Number(data.staff_id);
  const staffIds = Array.isArray(data.staff_ids)
    ? data.staff_ids.map((id) => String(id)).filter(Boolean).join(",")
    : String(data.staff_ids || "");
  const info = getDb().prepare(`
    INSERT INTO salon_services (salon_user_id, name, price, duration, hint, staff_id, staff_ids) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    salonUserId,
    data.name || "",
    data.price || "",
    data.duration || "",
    data.hint || "",
    Number.isFinite(staffId) ? staffId : null,
    staffIds
  );
  return getSalonServiceRow(Number(info.lastInsertRowid));
}

export function updateSalonService(id, salonUserId, data) {
  const current = getDb().prepare("SELECT * FROM salon_services WHERE id = ? AND salon_user_id = ?").get(id, salonUserId);
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

  getDb().prepare(`
    UPDATE salon_services SET name = ?, price = ?, duration = ?, hint = ?, staff_id = ?, staff_ids = ? WHERE id = ? AND salon_user_id = ?
  `).run(
    data.name ?? current.name,
    data.price ?? current.price,
    data.duration ?? current.duration,
    Object.prototype.hasOwnProperty.call(data, "hint") ? (data.hint || "") : current.hint,
    nextStaffId,
    nextStaffIds,
    id,
    salonUserId
  );
  return getSalonServiceRow(id);
}

export function deleteSalonService(id, salonUserId) {
  return getDb().prepare("DELETE FROM salon_services WHERE id = ? AND salon_user_id = ?").run(id, salonUserId).changes > 0;
}
