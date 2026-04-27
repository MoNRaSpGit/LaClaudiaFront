import { describe, expect, it } from 'vitest';
import scannerReducer, {
  addScannedProduct,
  decrementCartItem,
  selectScannerTotals,
  updateCartItem
} from './scannerSlice';

function createProduct(overrides = {}) {
  return {
    id: 10,
    nombre: 'Producto Test',
    precio_venta: 100,
    ...overrides
  };
}

describe('scannerSlice', () => {
  it('acumula cantidad cuando se escanea el mismo producto', () => {
    let state = scannerReducer(undefined, { type: 'init' });
    state = scannerReducer(state, addScannedProduct(createProduct()));
    state = scannerReducer(state, addScannedProduct(createProduct()));

    expect(state.cartItems).toHaveLength(1);
    expect(state.cartItems[0].quantity).toBe(2);
    expect(state.scanStatus).toBe('ok');
    expect(state.scanError).toBe('');
  });

  it('elimina la linea del carrito cuando la cantidad llega a cero', () => {
    let state = scannerReducer(undefined, { type: 'init' });
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 20 })));
    state = scannerReducer(state, decrementCartItem(20));

    expect(state.cartItems).toHaveLength(0);
  });

  it('calcula totales de carrito para panel/cobro', () => {
    const state = {
      scanner: {
        cartItems: [
          { id: 1, quantity: 2, precio_venta: 10.5 },
          { id: 2, quantity: 1, precio_venta: 3 }
        ]
      }
    };

    expect(selectScannerTotals(state)).toEqual({ items: 3, total: 24 });
  });

  it('actualiza producto del carrito al guardar edicion', () => {
    let state = scannerReducer(undefined, { type: 'init' });
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 30, nombre: 'Leche', precio_venta: 40 })));
    state = scannerReducer(
      state,
      updateCartItem({
        id: 30,
        nombre: 'Leche Entera',
        precio_venta: 55.5,
        thumbnail_url: 'https://img.local/leche.jpg'
      })
    );

    expect(state.cartItems[0].nombre).toBe('Leche Entera');
    expect(state.cartItems[0].precio_venta).toBe(55.5);
    expect(state.cartItems[0].thumbnail_url).toBe('https://img.local/leche.jpg');
  });
});
