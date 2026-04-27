import { warmupBackend } from '../../../shared/services/platform.api';
import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

export async function bootAuthShell() {
  const health = await warmupBackend({ minDelayMs: 3000 });
  return {
    backendReady: Boolean(health.ok)
  };
}

export async function loginReal({ username, password }) {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: buildHeaders({ json: true }),
    body: JSON.stringify({ username, password })
  });
  return readJson(response);
}

export async function logoutReal({ token } = {}) {
  const response = await fetch(`${apiUrl}/api/auth/logout`, {
    method: 'POST',
    headers: buildHeaders({ token })
  });
  return readJson(response);
}
