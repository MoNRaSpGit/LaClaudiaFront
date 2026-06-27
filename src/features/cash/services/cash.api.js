import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

export async function fetchCashInitialCash({ date, token } = {}) {
  const search = new URLSearchParams();
  if (date) {
    search.set('date', String(date));
  }

  const response = await fetch(`${apiUrl}/api/scanner/dashboard/initial-cash?${search.toString()}`, {
    headers: buildHeaders({ token })
  });

  return readJson(response);
}

export async function updateCashInitialCash(payload, { token } = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/dashboard/initial-cash`, {
    method: 'PUT',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload)
  });

  return readJson(response);
}
