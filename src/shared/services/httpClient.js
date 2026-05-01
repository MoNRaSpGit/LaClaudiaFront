export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function buildHeaders({ token, json = false } = {}) {
  const headers = {};
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = Number(response.status || 0);
    throw error;
  }
  return data;
}
