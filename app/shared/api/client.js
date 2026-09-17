export async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload, response };
}

export async function apiJson(path, options = {}) {
  const { ok, payload } = await apiFetch(path, options);
  return { ok, data: payload.data ?? payload, payload };
}
