const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function fetchHealth() {
  const response = await fetch(`${apiUrl}/api/health`);
  return readJson(response);
}

export async function fetchInitialProducts(limit = 5) {
  const response = await fetch(`${apiUrl}/api/scanner/products?limit=${limit}`);
  return readJson(response);
}

export async function fetchProductByBarcode(barcode) {
  const encoded = encodeURIComponent(String(barcode || '').trim());
  const response = await fetch(`${apiUrl}/api/scanner/products/lookup?barcode=${encoded}`);
  return readJson(response);
}

export { apiUrl };
