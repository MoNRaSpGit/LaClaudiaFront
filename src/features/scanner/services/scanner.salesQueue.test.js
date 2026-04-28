import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./scanner.api', () => ({
  createScannerSale: vi.fn()
}));

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    }
  };
}

async function loadQueueModule() {
  vi.resetModules();
  const api = await import('./scanner.api');
  const queueModule = await import('./scanner.salesQueue');
  return { api, queueModule };
}

describe('scanner.salesQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.window = {
      localStorage: createMemoryStorage(),
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  });

  it('encola y sincroniza ventas, vaciando pendientes al responder OK', async () => {
    const { api, queueModule } = await loadQueueModule();
    api.createScannerSale.mockResolvedValueOnce({ ok: true });

    queueModule.enqueueScannerSale({
      payload: { externalId: 'sale-1', items: [{ id: 1, quantity: 1 }] },
      token: 'token-1'
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.createScannerSale).toHaveBeenCalledTimes(1);
    expect(queueModule.getScannerSalesQueuePendingCount()).toBe(0);
  });

  it('mantiene la venta pendiente y notifica error cuando falla sincronizacion', async () => {
    const { api, queueModule } = await loadQueueModule();
    const error = new Error('network fail');
    api.createScannerSale.mockRejectedValueOnce(error);
    const errorListener = vi.fn();
    const unsubscribe = queueModule.subscribeScannerSalesQueueErrors(errorListener);

    queueModule.enqueueScannerSale({
      payload: { externalId: 'sale-2', items: [{ id: 2, quantity: 1 }] },
      token: 'token-2'
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.createScannerSale).toHaveBeenCalledTimes(1);
    expect(queueModule.getScannerSalesQueuePendingCount()).toBe(1);
    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledWith(error);
    unsubscribe();
  });

  it('descarta pendientes duplicados (409/duplicado) para no trabar la cola', async () => {
    const { api, queueModule } = await loadQueueModule();
    api.createScannerSale.mockRejectedValueOnce(new Error('Venta duplicado 409'));

    queueModule.enqueueScannerSale({
      payload: { externalId: 'sale-3', items: [{ id: 3, quantity: 1 }] },
      token: 'token-3'
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.createScannerSale).toHaveBeenCalledTimes(1);
    expect(queueModule.getScannerSalesQueuePendingCount()).toBe(0);
  });
});

