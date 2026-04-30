import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

export async function registerOperarioPayment(payload, options) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const response = await fetch(`${apiUrl}/api/scanner/payments`, {
    method: 'POST',
    headers: buildHeaders({ token: options?.token, json: true }),
    body: JSON.stringify(payload)
  });
  const data = await readJson(response);
  const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;

  return {
    ...data,
    _meta: {
      elapsedMs: Number(elapsedMs.toFixed(1))
    }
  };
}
