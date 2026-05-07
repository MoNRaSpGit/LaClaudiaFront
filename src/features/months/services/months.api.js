import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

export async function fetchMonthlySummary(params = {}, options = {}) {
  const search = new URLSearchParams();
  if (params.limitMonths != null) {
    search.set('limitMonths', String(params.limitMonths));
  }

  const response = await fetch(`${apiUrl}/api/scanner/dashboard/monthly-summary?${search.toString()}`, {
    headers: buildHeaders({ token: options?.token })
  });

  return readJson(response);
}

export async function updateMonthlyWeekOverride(payload, options = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/dashboard/monthly-summary/week`, {
    method: 'PUT',
    headers: buildHeaders({ token: options?.token, json: true }),
    body: JSON.stringify(payload)
  });

  return readJson(response);
}
