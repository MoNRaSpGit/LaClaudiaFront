import { apiUrl, buildHeaders, fetchJson } from '../../../shared/services/httpClient';
import { fetchProductsCatalog } from '../../products/services/products.api';
const productByBarcodeCache = new Map();
const negativeBarcodeCache = new Map();
const MAX_PRODUCT_CACHE_SIZE = 400;
const PRODUCT_CACHE_STORAGE_KEY = 'scanner_product_lookup_cache_v1';
const PRODUCT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const NEGATIVE_BARCODE_CACHE_TTL_MS = 1000 * 15;
let cacheHydrated = false;
let cachePersistTimer = null;

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

function nowMs() {
  return Date.now();
}

function isBrowserStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readPersistedCache() {
  if (!isBrowserStorageAvailable()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PRODUCT_CACHE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const cutoffMs = nowMs() - PRODUCT_CACHE_TTL_MS;
    return parsed.filter((entry) => {
      const barcode = normalizeBarcodeValue(entry?.barcode);
      const savedAt = Number(entry?.savedAt || 0);
      return Boolean(barcode) && savedAt >= cutoffMs && entry?.payload?.item;
    });
  } catch (_error) {
    return [];
  }
}

function persistCacheSoon() {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  if (cachePersistTimer) {
    window.clearTimeout(cachePersistTimer);
    cachePersistTimer = null;
  }

  const flush = () => {
    cachePersistTimer = null;
    try {
      const snapshot = Array.from(productByBarcodeCache.entries()).map(([barcode, payload]) => ({
        barcode,
        savedAt: nowMs(),
        payload: cloneLookupPayload(payload)
      }));
      window.localStorage.setItem(PRODUCT_CACHE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (_error) {
      // Keep scanner flow non-blocking if storage is unavailable.
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    cachePersistTimer = window.requestIdleCallback(flush, { timeout: 200 });
    return;
  }

  cachePersistTimer = window.setTimeout(flush, 120);
}

function hydrateCacheOnce() {
  if (cacheHydrated) {
    return;
  }
  cacheHydrated = true;

  const entries = readPersistedCache();
  entries.forEach((entry) => {
    const barcode = normalizeBarcodeValue(entry?.barcode);
    if (!barcode || !entry?.payload?.item) {
      return;
    }
    if (productByBarcodeCache.size >= MAX_PRODUCT_CACHE_SIZE) {
      const firstKey = productByBarcodeCache.keys().next().value;
      if (firstKey) {
        productByBarcodeCache.delete(firstKey);
      }
    }
    productByBarcodeCache.set(barcode, cloneLookupPayload(entry.payload));
  });
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
  persistCacheSoon();
}

export function warmScannerProductLookupCache(items = []) {
  hydrateCacheOnce();
  if (!Array.isArray(items) || !items.length) {
    return;
  }

  let changed = false;
  items.forEach((item) => {
    const barcode = normalizeBarcodeValue(item?.barcode_normalized || item?.barcode);
    if (!barcode || !item?.id || !item?.nombre) {
      return;
    }

    if (productByBarcodeCache.has(barcode)) {
      return;
    }

    if (productByBarcodeCache.size >= MAX_PRODUCT_CACHE_SIZE) {
      const firstKey = productByBarcodeCache.keys().next().value;
      if (firstKey) {
        productByBarcodeCache.delete(firstKey);
      }
    }

    productByBarcodeCache.set(barcode, cloneLookupPayload({ item }));
    changed = true;
  });

  if (changed) {
    persistCacheSoon();
  }
}

function markBarcodeAsMissing(barcode) {
  const normalized = normalizeBarcodeValue(barcode);
  if (!normalized) {
    return;
  }

  negativeBarcodeCache.set(normalized, {
    savedAt: nowMs()
  });
}

function isBarcodeTemporarilyMissing(barcode) {
  hydrateCacheOnce();

  const normalized = normalizeBarcodeValue(barcode);
  if (!normalized) {
    return false;
  }

  const entry = negativeBarcodeCache.get(normalized);
  if (!entry) {
    return false;
  }

  if (nowMs() - Number(entry.savedAt || 0) > NEGATIVE_BARCODE_CACHE_TTL_MS) {
    negativeBarcodeCache.delete(normalized);
    return false;
  }

  return true;
}

function createBarcodeNotFoundError(barcode) {
  const normalized = normalizeBarcodeValue(barcode);
  const error = new Error(`Barcode ${normalized || 'desconocido'} no encontrado.`);
  error.status = 404;
  error.statusText = 'Not Found';
  return error;
}

export async function fetchProductByBarcode(barcode) {
  hydrateCacheOnce();
  const normalized = normalizeBarcodeValue(barcode);
  if (productByBarcodeCache.has(normalized)) {
    return cloneLookupPayload(productByBarcodeCache.get(normalized));
  }

  if (isBarcodeTemporarilyMissing(normalized)) {
    throw createBarcodeNotFoundError(normalized);
  }

  const encoded = encodeURIComponent(normalized);
  try {
    const payload = await fetchJson(`${apiUrl}/api/scanner/products/lookup?barcode=${encoded}`);
    const foundBarcode = payload?.item?.barcode_normalized || payload?.item?.barcode || normalized;
    setCachedLookup(foundBarcode, payload);
    setCachedLookup(normalized, payload);
    return cloneLookupPayload(payload);
  } catch (error) {
    const status = Number(error?.status || 0);
    const message = String(error?.message || '').toLowerCase();
    if (status === 404 || message.includes('no encontrado') || message.includes('not found')) {
      markBarcodeAsMissing(normalized);
    }
    throw error;
  }
}

export async function preloadScannerProductLookupCache({ token, limit = 24 } = {}) {
  hydrateCacheOnce();

  const result = await fetchProductsCatalog({
    limit
  }, {
    token
  });

  const catalogItems = Array.isArray(result?.items)
    ? result.items
    : Array.isArray(result?.products)
      ? result.products
      : [];

  warmScannerProductLookupCache(catalogItems);
  return {
    count: catalogItems.length
  };
}

export async function updateScannerProduct(productId, payload, { token } = {}) {
  const normalizedId = Number(productId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('productId invalido para actualizar');
  }

  const result = await fetchJson(`${apiUrl}/api/scanner/products/${normalizedId}`, {
    method: 'PUT',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload || {})
  });

  if (result?.item) {
    const barcode = result.item.barcode_normalized || result.item.barcode;
    setCachedLookup(barcode, result);
  }

  return result;
}

export async function createScannerProduct(payload, { token } = {}) {
  const result = await fetchJson(`${apiUrl}/api/scanner/products`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload || {})
  });

  if (result?.item) {
    const barcode = result.item.barcode_normalized || result.item.barcode;
    setCachedLookup(barcode, result);
  }

  return result;
}

export async function createScannerSale(payload, { token } = {}) {
  return fetchJson(`${apiUrl}/api/scanner/sales`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload)
  });
}

export async function fetchScannerCustomers({ token } = {}) {
  return fetchJson(`${apiUrl}/api/scanner/customers`, {
    headers: buildHeaders({ token })
  });
}

export async function fetchScannerCustomerDetail(customerId, { token } = {}) {
  const normalizedId = Number(customerId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('customerId invalido');
  }

  return fetchJson(`${apiUrl}/api/scanner/customers/${normalizedId}`, {
    headers: buildHeaders({ token })
  });
}

export async function createScannerCustomer(payload, { token } = {}) {
  return fetchJson(`${apiUrl}/api/scanner/customers`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload || {})
  });
}

export async function deleteScannerCustomer(customerId, { token } = {}) {
  const normalizedId = Number(customerId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('customerId invalido');
  }

  return fetchJson(`${apiUrl}/api/scanner/customers/${normalizedId}`, {
    method: 'DELETE',
    headers: buildHeaders({ token })
  });
}

export async function createScannerCustomerAccountPayment(customerId, payload, { token } = {}) {
  const normalizedId = Number(customerId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('customerId invalido');
  }

  return fetchJson(`${apiUrl}/api/scanner/customers/${normalizedId}/payments`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload || {})
  });
}

export async function publishScannerLiveState(payload, { token } = {}) {
  return fetchJson(`${apiUrl}/api/scanner/live-state`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload || {})
  });
}

export async function createScannerDiagnosticEvent(payload, { token } = {}) {
  return fetchJson(`${apiUrl}/api/scanner/diagnostic-events`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify(payload || {})
  });
}

export { isBarcodeTemporarilyMissing };
export { apiUrl };
