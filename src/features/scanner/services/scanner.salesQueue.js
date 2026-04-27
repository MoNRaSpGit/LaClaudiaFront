import { createScannerSale } from './scanner.api';

const STORAGE_KEY = 'scanner_sales_queue_v1';
const RETRY_DELAY_MS = 2000;

let queueLoaded = false;
let queue = [];
let retryTimer = null;
const queueListeners = new Set();

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
    queue = Array.isArray(parsed) ? parsed : [];
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

function enqueue(payload) {
  queue.push({
    payload,
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
    } catch (error) {
      if (isDuplicateSaleError(error)) {
        queue.shift();
        persistQueue();
        notifyQueueListeners();
        continue;
      }

      scheduleRetry(token);
      return { pending: queue.length, error };
    }
  }

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

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
