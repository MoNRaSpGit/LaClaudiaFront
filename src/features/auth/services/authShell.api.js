import { warmupBackend } from '../../../shared/services/platform.api';
import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...(options || {}),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('La conexion tardo demasiado. Reintenta en unos segundos.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function bootAuthShell() {
  const health = await warmupBackend({ minDelayMs: 3000 });
  return {
    backendReady: Boolean(health.ok)
  };
}

export async function loginReal({ username, password }) {
  const response = await fetchWithTimeout(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: buildHeaders({ json: true }),
    body: JSON.stringify({ username, password })
  }, 12000);
  return readJson(response);
}

export async function logoutReal({ token } = {}) {
  const response = await fetchWithTimeout(`${apiUrl}/api/auth/logout`, {
    method: 'POST',
    headers: buildHeaders({ token })
  }, 8000);
  return readJson(response);
}

export async function touchSession({ token } = {}) {
  const response = await fetchWithTimeout(`${apiUrl}/api/auth/session`, {
    method: 'GET',
    headers: buildHeaders({ token })
  }, 8000);
  return readJson(response);
}
