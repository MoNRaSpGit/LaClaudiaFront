import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';
const productByBarcodeCache = new Map();
const MAX_PRODUCT_CACHE_SIZE = 400;

function normalizeBarcodeValue(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function cloneLookupPayload(payload = {}) {
  return {
    ...payload,
    item: payload?.item
      ? {
          ...payload.item
        }
      : null
  };
}

function setCachedLookup(barcode, payload) {
  const normalized = normalizeBarcodeValue(barcode);
  if (!normalized || !payload?.item) {
    return;
  }

  if (productByBarcodeCache.size >= MAX_PRODUCT_CACHE_SIZE) {
    const firstKey = productByBarcodeCache.keys().next().value;
    if (firstKey) {
      productByBarcodeCache.delete(firstKey);
    }
  }

  productByBarcodeCache.set(normalized, cloneLookupPayload(payload));
}

export async function fetchProductByBarcode(barcode) {
  const normalized = normalizeBarcodeValue(barcode);
  if (productByBarcodeCache.has(normalized)) {
    return cloneLookupPayload(productByBarcodeCache.get(normalized));
  }

  const encoded = encodeURIComponent(normalized);
  const response = await fetch(`${apiUrl}/api/scanner/products/lookup?barcode=${encoded}`);
  const payload = await readJson(response);
  const foundBarcode = payload?.item?.barcode_normalized || payload?.item?.barcode || normalized;
  setCachedLookup(foundBarcode, payload);
  setCachedLookup(normalized, payload);
  return cloneLookupPayload(payload);
}

export async function createScannerSale(payload, { token } = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/sales`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function publishScannerLiveState(payload, { token } = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/live-state`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload || {})
  });
  return readJson(response);
}

export { apiUrl };
