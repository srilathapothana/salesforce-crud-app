// All calls go through the same origin in production, and through the
// Vite dev proxy (see vite.config.js) in development, so we can always
// use relative paths here.

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (res.status === 401) {
    const err = new Error("unauthenticated");
    err.unauthenticated = true;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error && data.error.message ? data.error.message : JSON.stringify(data.error || data));
  }
  return data;
}

export const api = {
  authStatus: () => request("/api/auth/status"),
  logout: () => request("/auth/logout", { method: "POST" }),
  getObjects: () => request("/api/objects"),
  getRecords: (objectName, offset, limit = 20) =>
    request(`/api/records/${objectName}?offset=${offset}&limit=${limit}`),
  getRecord: (objectName, id) => request(`/api/records/${objectName}/${id}`),
  createRecord: (objectName, fields) =>
    request(`/api/records/${objectName}`, { method: "POST", body: JSON.stringify(fields) }),
  updateRecord: (objectName, id, fields) =>
    request(`/api/records/${objectName}/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),
  deleteRecord: (objectName, id) =>
    request(`/api/records/${objectName}/${id}`, { method: "DELETE" })
};
