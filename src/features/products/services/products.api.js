import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

export async function fetchProductsCatalog({ query, limit = 20 } = {}) {
  const params = new URLSearchParams();
  const normalizedQuery = String(query || '').trim();
  const normalizedLimit = Number.isFinite(Number(limit)) ? String(limit) : '20';

  params.set('limit', normalizedLimit);
  if (normalizedQuery) {
    params.set('q', normalizedQuery);
  }

  const response = await fetch(`${apiUrl}/api/scanner/products?${params.toString()}`);
  return readJson(response);
}

export async function updateProductsCatalogItem(productId, payload, { token } = {}) {
  const normalizedId = Number(productId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('productId invalido para actualizar');
  }

  const response = await fetch(`${apiUrl}/api/scanner/products/${normalizedId}`, {
    method: 'PUT',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload || {})
  });

  return readJson(response);
}
