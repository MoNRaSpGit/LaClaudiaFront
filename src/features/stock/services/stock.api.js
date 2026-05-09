import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

export async function fetchTopSellingProducts({ rankingLimit = 10 } = {}, options = {}) {
  const search = new URLSearchParams();
  search.set('rankingLimit', String(rankingLimit));

  const response = await fetch(`${apiUrl}/api/scanner/dashboard/ranking?${search.toString()}`, {
    headers: buildHeaders({ token: options?.token })
  });

  return readJson(response);
}

export async function fetchStockRequests(options = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/stock-requests`, {
    headers: buildHeaders({ token: options?.token })
  });

  return readJson(response);
}

export async function createStockRequest(payload, options = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/stock-requests`, {
    method: 'POST',
    headers: buildHeaders({ token: options?.token, json: true }),
    body: JSON.stringify(payload)
  });

  return readJson(response);
}

export async function updateStockRequest(requestId, payload, options = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/stock-requests/${requestId}`, {
    method: 'PUT',
    headers: buildHeaders({ token: options?.token, json: true }),
    body: JSON.stringify(payload)
  });

  return readJson(response);
}

export async function resolveStockRequest(requestId, options = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/stock-requests/${requestId}/resolve`, {
    method: 'PUT',
    headers: buildHeaders({ token: options?.token })
  });

  return readJson(response);
}
