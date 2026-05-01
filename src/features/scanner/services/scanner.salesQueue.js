import { createScannerSale } from './scanner.api';

const STORAGE_KEY = 'scanner_sales_queue_v1';
const RETRY_DELAY_MS = 2000;

let queueLoaded = false;
let queue = [];
let retryTimer = null;
let lastQueueError = null;
const queueListeners = new Set();
const queueErrorListeners = new Set();

function sanitizeSaleItemForTransport(item = {}) {
  const quantity = Number(item.quantity || 1);
  const unitPrice = Number(item.precio_venta || 0);

  return {
    id: item.id,
    productId: item.productId ?? null,
    isManual: Boolean(item.isManual),
    nombre: String(item.nombre || '').trim(),
    precio_venta: Number.isFinite(unitPrice) ? unitPrice : 0,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  };
}

function sanitizeSalePayload(payload = {}) {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  return {
    externalId: String(payload.externalId || payload.id || '').trim(),
    userId: payload.userId ?? null,
    notes: payload.notes ?? null,
    items: rawItems.map(sanitizeSaleItemForTransport)
  };
}

function sanitizeQueueEntry(entry = {}) {
  return {
    payload: sanitizeSalePayload(entry.payload || {}),
    queuedAt: String(entry.queuedAt || '').trim() || new Date().toISOString()
  };
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadQueueOnce() {
  if (queueLoaded) {
    return;
  }
  queueLoaded = true;
  if (!isBrowser()) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    queue = Array.isArray(parsed) ? parsed.map(sanitizeQueueEntry) : [];
    persistQueue();
  } catch (_error) {
    queue = [];
  }
}

function persistQueue() {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (_error) {
    // Ignore storage errors to keep checkout path non-blocking.
  }
}

function notifyQueueListeners() {
  const pending = queue.length;
  queueListeners.forEach((listener) => {
    try {
      listener(pending);
    } catch (_error) {
      // Ignore listener errors to keep queue flow resilient.
    }
  });
}

function notifyQueueErrorListeners(error) {
  lastQueueError = error
    ? {
        message: String(error?.message || '').trim() || 'Error de sincronizacion',
        status: Number(error?.status || 0),
        at: new Date().toISOString()
      }
    : null;

  queueErrorListeners.forEach((listener) => {
    try {
      listener(error);
    } catch (_listenerError) {
      // Ignore listener errors to keep queue flow resilient.
    }
  });
}

function enqueue(payload) {
  queue.push({
    payload: sanitizeSalePayload(payload),
    queuedAt: new Date().toISOString()
  });
  persistQueue();
  notifyQueueListeners();
}

function normalizeErrorMessage(error) {
  return String(error?.message || '').toLowerCase();
}

function isDuplicateSaleError(error) {
  const message = normalizeErrorMessage(error);
  return message.includes('duplicado') || message.includes('ya fue registrada') || message.includes('409');
}

function isUnauthorizedError(error) {
  if (Number(error?.status) === 401) {
    return true;
  }
  const message = normalizeErrorMessage(error);
  return message.includes('401') || message.includes('unauthorized') || message.includes('sesion expirada');
}

function scheduleRetry(token) {
  if (retryTimer) {
    clearTimeout(retryTimer);
  }

  retryTimer = setTimeout(() => {
    flushScannerSalesQueue({ token }).catch(() => {});
  }, RETRY_DELAY_MS);
}

export async function flushScannerSalesQueue({ token } = {}) {
  loadQueueOnce();
  if (!token || !queue.length) {
    return { pending: queue.length };
  }

  while (queue.length) {
    const current = queue[0];
    try {
      await createScannerSale(current.payload, { token });
      queue.shift();
      persistQueue();
      notifyQueueListeners();
      if (!queue.length) {
        lastQueueError = null;
      }
    } catch (error) {
      if (isDuplicateSaleError(error)) {
        queue.shift();
        persistQueue();
        notifyQueueListeners();
        if (!queue.length) {
          lastQueueError = null;
        }
        continue;
      }

      if (isUnauthorizedError(error)) {
        notifyQueueErrorListeners(error);
        return { pending: queue.length, error };
      }

      scheduleRetry(token);
      notifyQueueErrorListeners(error);
      return { pending: queue.length, error };
    }
  }

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  lastQueueError = null;

  return { pending: 0 };
}

export function enqueueScannerSale({ payload, token }) {
  loadQueueOnce();
  enqueue(payload);
  flushScannerSalesQueue({ token }).catch(() => {
    scheduleRetry(token);
  });
}

export function getScannerSalesQueuePendingCount() {
  loadQueueOnce();
  return queue.length;
}

export function subscribeScannerSalesQueue(listener) {
  loadQueueOnce();
  if (typeof listener !== 'function') {
    return () => {};
  }

  queueListeners.add(listener);
  listener(queue.length);

  return () => {
    queueListeners.delete(listener);
  };
}

export function subscribeScannerSalesQueueErrors(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  queueErrorListeners.add(listener);
  return () => {
    queueErrorListeners.delete(listener);
  };
}

export function getScannerSalesQueueDebugSnapshot() {
  loadQueueOnce();
  return {
    pending: queue.length,
    retryScheduled: Boolean(retryTimer),
    lastError: lastQueueError
  };
}
