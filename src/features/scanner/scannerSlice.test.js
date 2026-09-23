import { beforeEach, describe, expect, it, vi } from 'vitest';
import scannerReducer, {
  addScannedProduct,
  clearCart,
  decrementCartItem,
  resetScannerState,
  selectCajaSummaries,
  selectScannerTotals,
  setActiveCaja,
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

function activeCaja(state) {
  return state.cajas[state.activeCajaId];
}

describe('scannerSlice - carrito de la caja activa', () => {
  it('acumula cantidad cuando se escanea el mismo producto', () => {
    let state = scannerReducer(undefined, { type: 'init' });
    state = scannerReducer(state, addScannedProduct(createProduct()));
    state = scannerReducer(state, addScannedProduct(createProduct()));

    expect(activeCaja(state).cartItems).toHaveLength(1);
    expect(activeCaja(state).cartItems[0].quantity).toBe(2);
    expect(activeCaja(state).scanStatus).toBe('ok');
    expect(activeCaja(state).scanError).toBe('');
  });

  it('elimina la linea del carrito cuando la cantidad llega a cero', () => {
    let state = scannerReducer(undefined, { type: 'init' });
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 20 })));
    state = scannerReducer(state, decrementCartItem(20));

    expect(activeCaja(state).cartItems).toHaveLength(0);
  });

  it('calcula totales de carrito para panel/cobro (de la caja activa)', () => {
    const state = {
      scanner: {
        activeCajaId: 'caja1',
        cajas: {
          caja1: { cartItems: [{ id: 1, quantity: 2, precio_venta: 10.5 }, { id: 2, quantity: 1, precio_venta: 3 }] },
          caja2: { cartItems: [{ id: 3, quantity: 5, precio_venta: 1 }] }
        }
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

    expect(activeCaja(state).cartItems[0].nombre).toBe('Leche Entera');
    expect(activeCaja(state).cartItems[0].precio_venta).toBe(55.5);
    expect(activeCaja(state).cartItems[0].thumbnail_url).toBe('https://img.local/leche.jpg');
  });

  it('no vuelve a aplicar un precio editado en una venta vieja al re-escanear el mismo producto despues (caso real: Grasa vacuna Dori)', () => {
    let state = scannerReducer(undefined, { type: 'init' });

    state = scannerReducer(state, addScannedProduct(createProduct({ id: 40, nombre: 'Grasa vacuna Dori', precio_venta: 50 })));
    state = scannerReducer(state, updateCartItem({ id: 40, precio_venta: 30 }));
    expect(activeCaja(state).cartItems[0].precio_venta).toBe(30);

    state = scannerReducer(state, clearCart());

    state = scannerReducer(state, addScannedProduct(createProduct({ id: 40, nombre: 'Grasa vacuna Dori', precio_venta: 50 })));
    expect(activeCaja(state).cartItems[0].precio_venta).toBe(50);
  });

  it('resetea las dos cajas y vuelve a Caja 1 al cerrar sesion', () => {
    let state = scannerReducer(undefined, { type: 'init' });
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 99 })));
    state = scannerReducer(state, setActiveCaja('caja2'));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 88 })));

    expect(state.cajas.caja1.cartItems).toHaveLength(1);
    expect(state.cajas.caja2.cartItems).toHaveLength(1);

    state = scannerReducer(state, resetScannerState());

    expect(state.activeCajaId).toBe('caja1');
    expect(state.cajas.caja1.cartItems).toHaveLength(0);
    expect(state.cajas.caja2.cartItems).toHaveLength(0);
    expect(state.cajas.caja1.liveEditor).toBeNull();
    expect(state.cajas.caja2.liveEditor).toBeNull();
  });
});

describe('scannerSlice - Caja 1 / Caja 2 son independientes', () => {
  it('cargar productos en Caja 1, cambiar a Caja 2 y volver: Caja 1 sigue exactamente igual', () => {
    let state = scannerReducer(undefined, { type: 'init' });

    // Caja 1: cliente con 5 productos, venta sin terminar.
    for (let i = 1; i <= 5; i += 1) {
      state = scannerReducer(state, addScannedProduct(createProduct({ id: i, nombre: `Producto ${i}`, precio_venta: 10 * i })));
    }
    expect(state.cajas.caja1.cartItems).toHaveLength(5);

    // Llega otro cliente: cambio a Caja 2, que aparece limpia.
    state = scannerReducer(state, setActiveCaja('caja2'));
    expect(activeCaja(state).cartItems).toHaveLength(0);

    // Atiendo al segundo cliente en Caja 2.
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 200, nombre: 'Gaseosa', precio_venta: 80 })));
    expect(activeCaja(state).cartItems).toHaveLength(1);

    // Vuelvo a Caja 1: los 5 productos del primer cliente siguen ahi tal cual.
    state = scannerReducer(state, setActiveCaja('caja1'));
    expect(activeCaja(state).cartItems).toHaveLength(5);
    expect(activeCaja(state).cartItems.map((item) => item.id).sort()).toEqual([1, 2, 3, 4, 5]);

    // Caja 2 sigue con lo suyo, sin mezclarse.
    state = scannerReducer(state, setActiveCaja('caja2'));
    expect(activeCaja(state).cartItems).toHaveLength(1);
    expect(activeCaja(state).cartItems[0].nombre).toBe('Gaseosa');
  });

  it('cobrar (limpiar el carrito) en una caja no toca la otra caja', () => {
    let state = scannerReducer(undefined, { type: 'init' });

    state = scannerReducer(state, addScannedProduct(createProduct({ id: 1 })));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 2 })));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 3 })));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 4 })));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 5 })));
    state = scannerReducer(state, setActiveCaja('caja2'));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 6 })));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 7 })));

    expect(state.cajas.caja1.cartItems).toHaveLength(5);
    expect(state.cajas.caja2.cartItems).toHaveLength(2);

    // Confirmo el cobro de Caja 2 (chargeCart hace dispatch(clearCart()) al cobrar).
    state = scannerReducer(state, clearCart());

    expect(state.cajas.caja2.cartItems).toHaveLength(0);
    // Caja 1 sigue exactamente igual, con sus 5 productos.
    expect(state.cajas.caja1.cartItems).toHaveLength(5);
  });

  it('editar un producto en Caja 2 no afecta el mismo producto ya cargado en Caja 1', () => {
    let state = scannerReducer(undefined, { type: 'init' });

    state = scannerReducer(state, addScannedProduct(createProduct({ id: 1, nombre: 'Leche', precio_venta: 100 })));
    state = scannerReducer(state, setActiveCaja('caja2'));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 1, nombre: 'Leche', precio_venta: 100 })));
    state = scannerReducer(state, updateCartItem({ id: 1, precio_venta: 70 }));

    expect(state.cajas.caja2.cartItems[0].precio_venta).toBe(70);
    expect(state.cajas.caja1.cartItems[0].precio_venta).toBe(100);
  });

  it('setActiveCaja con un id invalido no rompe nada (no-op)', () => {
    let state = scannerReducer(undefined, { type: 'init' });
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 1 })));
    const before = state;

    state = scannerReducer(state, setActiveCaja('caja99'));

    expect(state.activeCajaId).toBe('caja1');
    expect(state).toEqual(before);
  });

  it('selectCajaSummaries devuelve label, cantidad de items y cual esta activa', () => {
    let state = scannerReducer(undefined, { type: 'init' });
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 1, quantity: 1 })));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 1 }))); // suma cantidad -> 2
    state = scannerReducer(state, setActiveCaja('caja2'));
    state = scannerReducer(state, addScannedProduct(createProduct({ id: 2 })));

    const summaries = selectCajaSummaries({ scanner: state });

    expect(summaries).toEqual([
      { id: 'caja1', label: 'Caja 1', itemCount: 2, isActive: false },
      { id: 'caja2', label: 'Caja 2', itemCount: 1, isActive: true }
    ]);
  });
});

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

describe('scannerSlice - migracion desde el carrito unico viejo', () => {
  const STORAGE_KEY = 'scanner_state_v1';

  beforeEach(() => {
    globalThis.window = {
      localStorage: createMemoryStorage(),
      requestIdleCallback: undefined,
      cancelIdleCallback: undefined
    };
  });

  it('migra un carrito guardado en el formato viejo (sin Caja 1/Caja 2) a Caja 1, sin perder nada', async () => {
    const oldShapePayload = {
      cartItems: [
        { id: 1, nombre: 'Producto viejo', precio_venta: 55, quantity: 3 }
      ],
      lastScannedItemId: 1,
      lastScannedAt: '2026-09-01T10:00:00.000Z',
      liveEditor: null
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(oldShapePayload));

    vi.resetModules();
    const fresh = await import('./scannerSlice');
    const state = fresh.default(undefined, { type: 'init' });

    expect(state.activeCajaId).toBe('caja1');
    expect(state.cajas.caja1.cartItems).toEqual(oldShapePayload.cartItems);
    expect(state.cajas.caja1.lastScannedItemId).toBe(1);
    expect(state.cajas.caja2.cartItems).toEqual([]);
  });

  it('carga un estado ya guardado en el formato nuevo (con cajas) tal cual', async () => {
    const newShapePayload = {
      activeCajaId: 'caja2',
      cajas: {
        caja1: { cartItems: [{ id: 1, nombre: 'A', precio_venta: 10, quantity: 1 }] },
        caja2: { cartItems: [{ id: 2, nombre: 'B', precio_venta: 20, quantity: 1 }] }
      }
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newShapePayload));

    vi.resetModules();
    const fresh = await import('./scannerSlice');
    const state = fresh.default(undefined, { type: 'init' });

    expect(state.activeCajaId).toBe('caja2');
    expect(state.cajas.caja1.cartItems).toEqual(newShapePayload.cajas.caja1.cartItems);
    expect(state.cajas.caja2.cartItems).toEqual(newShapePayload.cajas.caja2.cartItems);
  });
});
