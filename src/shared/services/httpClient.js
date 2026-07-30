export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const DEFAULT_FETCH_TIMEOUT_MS = 15000;

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
    error.statusText = String(response.statusText || '').trim();
    error.code = String(data?.code || '').trim();
    throw error;
  }
  return data;
}

/**
 * fetch() con timeout: sin esto, un backend colgado deja promesas que nunca
 * resuelven, y eso traba estados de loading en la UI (ver bug de turnos colgados).
 */
export async function fetchWithTimeout(url, { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, ...fetchOptions } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('La conexion tardo demasiado. Intenta nuevamente.');
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  return readJson(response);
}
