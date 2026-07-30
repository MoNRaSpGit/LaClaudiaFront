import { beforeEach, describe, expect, it, vi } from 'vitest';

let api;

async function loadApi() {
  vi.resetModules();
  api = await import('./scanner.api');
  return api;
}

describe('scanner.api contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('fetchProductByBarcode llama endpoint lookup con query esperada', async () => {
    await loadApi();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        item: { id: 12, nombre: 'Arroz', barcode: '123', barcode_normalized: '123' }
      })
    });

    const result = await api.fetchProductByBarcode(' 123 ');

    expect(global.fetch.mock.calls[0][0]).toEqual(expect.stringContaining('/api/scanner/products/lookup?barcode=123'));
    expect(result?.item?.id).toBe(12);
  });

  it('reutiliza el cache cuando el mismo barcode se consulta dos veces', async () => {
    await loadApi();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        item: { id: 18, nombre: 'Aceite', barcode: '889', barcode_normalized: '889' }
      })
    });

    const first = await api.fetchProductByBarcode('889');
    const second = await api.fetchProductByBarcode(' 889 ');

    expect(first?.item?.id).toBe(18);
    expect(second?.item?.id).toBe(18);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('bloquea consultas repetidas de un barcode inexistente sin volver al backend', async () => {
    await loadApi();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        message: 'Barcode 999 no encontrado.'
      })
    });

    await expect(api.fetchProductByBarcode('999')).rejects.toThrow(/no encontrado/i);
    await expect(api.fetchProductByBarcode(' 999 ')).rejects.toThrow(/no encontrado/i);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('preloadScannerProductLookupCache deja el cache listo sin pegarle al lookup', async () => {
    await loadApi();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: 31, nombre: 'Galletitas', barcode: '3001', barcode_normalized: '3001' },
          { id: 32, nombre: 'Yogur', barcode: '3002', barcode_normalized: '3002' }
        ]
      })
    });

    await api.preloadScannerProductLookupCache({ token: 'tk-preload', limit: 2 });
    const result = await api.fetchProductByBarcode('3001');

    expect(result?.item?.id).toBe(31);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/scanner/products?limit=2')
    );
  });

  it('updateScannerProduct valida productId y hace PUT con JSON + Authorization', async () => {
    await loadApi();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        item: { id: 10, nombre: 'Leche', barcode: '789' }
      })
    });

    await api.updateScannerProduct(10, { nombre: 'Leche Entera', precio_venta: 150 }, { token: 'tk-1' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/scanner/products/10'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer tk-1'
        })
      })
    );

    await expect(api.updateScannerProduct(0, { nombre: 'x' }, { token: 'tk-1' })).rejects.toThrow(/productId/i);
  });

  it('createScannerProduct hace POST con JSON + Authorization', async () => {
    await loadApi();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        item: { id: 22, nombre: 'Coca Cola 600ml', barcode: '779' }
      })
    });

    await api.createScannerProduct(
      { barcode: '779', nombre: 'Coca Cola 600ml', precio_venta: 150 },
      { token: 'tk-create' }
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/scanner/products'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer tk-create'
        })
      })
    );
  });

  it('createScannerSale y publishScannerLiveState envian payload JSON al backend', async () => {
    await loadApi();
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, saleId: 's1' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });

    await api.createScannerSale({ externalId: 'sale-1', items: [{ id: 1, quantity: 1 }] }, { token: 'tk-sale' });
    await api.publishScannerLiveState({ items: [{ id: 1, quantity: 1 }] }, { token: 'tk-live' });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/scanner/sales'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer tk-sale'
        })
      })
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/scanner/live-state'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer tk-live'
        })
      })
    );
  });
});
