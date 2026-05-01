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

  it('sanea payloads viejos y nuevos para no mandar thumbnail_url pesado en ventas', async () => {
    globalThis.window = {
      localStorage: createMemoryStorage(),
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    globalThis.window.localStorage.setItem('scanner_sales_queue_v1', JSON.stringify([
      {
        payload: {
          externalId: 'sale-old',
          userId: 7,
          items: [
            {
              id: 'old-1',
              productId: 10,
              isManual: false,
              nombre: 'Queso',
              precio_venta: 150,
              quantity: 1,
              thumbnail_url: 'data:image/png;base64,muy-pesada'
            }
          ]
        },
        queuedAt: '2026-05-01T12:00:00.000Z'
      }
    ]));

    const { api, queueModule } = await loadQueueModule();
    api.createScannerSale
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    await queueModule.flushScannerSalesQueue({ token: 'token-old' });

    queueModule.enqueueScannerSale({
      payload: {
        externalId: 'sale-new',
        userId: 8,
        items: [
          {
            id: 'new-1',
            productId: 20,
            isManual: false,
            nombre: 'Yerba',
            precio_venta: 90,
            quantity: 2,
            thumbnail_url: 'data:image/png;base64,muy-pesada'
          }
        ]
      },
      token: 'token-new'
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.createScannerSale).toHaveBeenCalledTimes(2);
    expect(api.createScannerSale.mock.calls[0][0].items[0]).not.toHaveProperty('thumbnail_url');
    expect(api.createScannerSale.mock.calls[1][0].items[0]).not.toHaveProperty('thumbnail_url');
  });
});
