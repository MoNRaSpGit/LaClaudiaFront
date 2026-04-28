import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createScannerSale,
  fetchProductByBarcode,
  publishScannerLiveState,
  updateScannerProduct
} from './scanner.api';

describe('scanner.api contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('fetchProductByBarcode llama endpoint lookup con query esperada', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        item: { id: 12, nombre: 'Arroz', barcode: '123', barcode_normalized: '123' }
      })
    });

    const result = await fetchProductByBarcode(' 123 ');

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/scanner/products/lookup?barcode=123'));
    expect(result?.item?.id).toBe(12);
  });

  it('updateScannerProduct valida productId y hace PUT con JSON + Authorization', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        item: { id: 10, nombre: 'Leche', barcode: '789' }
      })
    });

    await updateScannerProduct(10, { nombre: 'Leche Entera', precio_venta: 150 }, { token: 'tk-1' });

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

    await expect(updateScannerProduct(0, { nombre: 'x' }, { token: 'tk-1' })).rejects.toThrow(/productId/i);
  });

  it('createScannerSale y publishScannerLiveState envian payload JSON al backend', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, saleId: 's1' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });

    await createScannerSale({ externalId: 'sale-1', items: [{ id: 1, quantity: 1 }] }, { token: 'tk-sale' });
    await publishScannerLiveState({ items: [{ id: 1, quantity: 1 }] }, { token: 'tk-live' });

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

