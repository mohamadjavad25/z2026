import { apiFetch } from "./client";

/** POST /api/customers/rename { phone, name } → { renamed }: every booking of this number gets one name. */
export async function renameCustomer(phone, name) {
  return apiFetch("/api/customers/rename", { method: "POST", body: JSON.stringify({ phone, name }) });
}
