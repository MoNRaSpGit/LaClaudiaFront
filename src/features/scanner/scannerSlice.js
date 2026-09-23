import { createSelector, createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'scanner_state_v1';
const CAJA_IDS = ['caja1', 'caja2'];
const CAJA_LABELS = {
  caja1: 'Caja 1',
  caja2: 'Caja 2'
};
let persistTimeoutId = null;
let persistIdleCallbackId = null;
let latestPersistPayload = null;

function createEmptyCajaState() {
  return {
    scanBarcode: '',
    scanStatus: 'idle',
    scanError: '',
    cartItems: [],
    lastScannedItemId: null,
    lastScannedAt: null,
    liveEditor: null
  };
}

function createEmptyCajasState() {
  return {
    caja1: createEmptyCajaState(),
    caja2: createEmptyCajaState()
  };
}

const initialState = {
  activeCajaId: 'caja1',
  cajas: createEmptyCajasState()
};

function extractPersistableCaja(cajaState) {
  return {
    cartItems: Array.isArray(cajaState?.cartItems) ? cajaState.cartItems : [],
    lastScannedItemId: cajaState?.lastScannedItemId || null,
    lastScannedAt: cajaState?.lastScannedAt || null,
    liveEditor: cajaState?.liveEditor || null
  };
}

function readPersistedScannerState() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    // Migracion desde el formato viejo (un solo carrito, sin Caja 1/Caja 2):
    // lo que hubiera queda en Caja 1 tal cual, sin perder nada. Caja 2 arranca
    // vacia.
    if (!parsed.cajas && Array.isArray(parsed.cartItems)) {
      return {
        activeCajaId: 'caja1',
        cajas: {
          caja1: {
            ...createEmptyCajaState(),
            cartItems: parsed.cartItems || [],
            lastScannedItemId: parsed.lastScannedItemId || null,
            lastScannedAt: parsed.lastScannedAt || null,
            liveEditor: parsed.liveEditor || null
          },
          caja2: createEmptyCajaState()
        }
      };
    }

    if (parsed.cajas && typeof parsed.cajas === 'object') {
      return {
        activeCajaId: CAJA_IDS.includes(parsed.activeCajaId) ? parsed.activeCajaId : 'caja1',
        cajas: {
          caja1: {
            ...createEmptyCajaState(),
            ...(parsed.cajas.caja1 || {}),
            scanStatus: 'idle',
            scanError: '',
            scanBarcode: ''
          },
          caja2: {
            ...createEmptyCajaState(),
            ...(parsed.cajas.caja2 || {}),
            scanStatus: 'idle',
            scanError: '',
            scanBarcode: ''
          }
        }
      };
    }

    return null;
  } catch (_error) {
    return null;
  }
}

function persistScannerState(state) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  latestPersistPayload = {
    activeCajaId: CAJA_IDS.includes(state.activeCajaId) ? state.activeCajaId : 'caja1',
    cajas: {
      caja1: extractPersistableCaja(state.cajas?.caja1),
      caja2: extractPersistableCaja(state.cajas?.caja2)
    }
  };

  if (persistTimeoutId) {
    clearTimeout(persistTimeoutId);
    persistTimeoutId = null;
  }
  if (persistIdleCallbackId && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(persistIdleCallbackId);
    persistIdleCallbackId = null;
  }

  const flushPersist = () => {
    persistTimeoutId = null;
    persistIdleCallbackId = null;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(latestPersistPayload));
    } catch (_error) {
      // Ignore persistence errors to keep scanner flow uninterrupted.
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    persistIdleCallbackId = window.requestIdleCallback(flushPersist, { timeout: 250 });
    return;
  }

  persistTimeoutId = setTimeout(flushPersist, 80);
}

const hydratedInitialState = readPersistedScannerState() || initialState;

function calculateTotals(cartItems = []) {
  return cartItems.reduce(
    (acc, item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.precio_venta || 0);
      acc.items += quantity;
      acc.total += unitPrice * quantity;
      return acc;
    },
    { items: 0, total: 0 }
  );
}

const scannerSlice = createSlice({
  name: 'scanner',
  initialState: hydratedInitialState,
  reducers: {
    setActiveCaja(state, action) {
      const nextCajaId = String(action.payload || '').trim();
      if (!CAJA_IDS.includes(nextCajaId) || nextCajaId === state.activeCajaId) {
        return;
      }
      state.activeCajaId = nextCajaId;
      persistScannerState(state);
    },
    setScanBarcode(state, action) {
      state.cajas[state.activeCajaId].scanBarcode = action.payload;
    },
    setScanLoading(state) {
      const caja = state.cajas[state.activeCajaId];
      caja.scanStatus = 'loading';
      caja.scanError = '';
      persistScannerState(state);
    },
    addScannedProduct(state, action) {
      // El precio/nombre viene siempre del lookup fresco (backend/cache de
      // lookup, que ya se actualiza solo al editar un producto) - no se pisa
      // con ninguna "correccion" guardada localmente en este dispositivo. Asi
      // el catalogo real (la base) manda siempre, en cualquier caja.
      const caja = state.cajas[state.activeCajaId];
      const product = action.payload || {};
      caja.scanStatus = 'ok';
      caja.scanError = '';
      caja.scanBarcode = '';

      const existing = caja.cartItems.find((item) => String(item.id) === String(product.id));
      if (existing) {
        existing.quantity += 1;
        existing.scannedAt = new Date().toISOString();
        caja.cartItems = [
          existing,
          ...caja.cartItems.filter((entry) => String(entry.id) !== String(existing.id))
        ];
        caja.lastScannedItemId = existing.id;
        caja.lastScannedAt = existing.scannedAt;
        persistScannerState(state);
        return;
      }

      const scannedAt = new Date().toISOString();
      caja.cartItems.unshift({
        ...product,
        quantity: 1,
        scannedAt
      });
      caja.lastScannedItemId = product.id;
      caja.lastScannedAt = scannedAt;
      persistScannerState(state);
    },
    setScanError(state, action) {
      const caja = state.cajas[state.activeCajaId];
      caja.scanStatus = 'error';
      caja.scanError = action.payload;
      persistScannerState(state);
    },
    decrementCartItem(state, action) {
      const caja = state.cajas[state.activeCajaId];
      const itemId = String(action.payload);
      const item = caja.cartItems.find((entry) => String(entry.id) === itemId);
      if (!item) {
        return;
      }
      item.quantity -= 1;
      if (item.quantity <= 0) {
        caja.cartItems = caja.cartItems.filter((entry) => String(entry.id) !== itemId);
      }
      persistScannerState(state);
    },
    updateCartItem(state, action) {
      const caja = state.cajas[state.activeCajaId];
      const payload = action.payload || {};
      const itemId = String(payload.id || '');
      const item = caja.cartItems.find((entry) => String(entry.id) === itemId);
      if (!item) {
        return;
      }

      if (payload.nombre !== undefined) {
        item.nombre = String(payload.nombre || '').trim() || item.nombre;
      }
      if (payload.precio_venta !== undefined) {
        item.precio_venta = Number(payload.precio_venta || item.precio_venta);
      }
      if (payload.thumbnail_url !== undefined) {
        item.thumbnail_url = payload.thumbnail_url || null;
      }

      persistScannerState(state);
    },
    setQuickAddSyncState(state, action) {
      const caja = state.cajas[state.activeCajaId];
      const payload = action.payload || {};
      const itemId = String(payload.id || '');
      const item = caja.cartItems.find((entry) => String(entry.id) === itemId);
      if (!item) {
        return;
      }

      item.isQuickAddPending = Boolean(payload.isQuickAddPending);
      item.quickAddSyncError = String(payload.quickAddSyncError || '').trim();
      persistScannerState(state);
    },
    reconcileQuickAddProduct(state, action) {
      const caja = state.cajas[state.activeCajaId];
      const payload = action.payload || {};
      const tempId = String(payload.tempId || '');
      const serverItem = payload.item || null;
      if (!tempId || !serverItem?.id) {
        return;
      }

      const optimisticIndex = caja.cartItems.findIndex((entry) => String(entry.id) === tempId);
      if (optimisticIndex === -1) {
        return;
      }

      const optimisticItem = caja.cartItems[optimisticIndex];
      const existingServerIndex = caja.cartItems.findIndex(
        (entry) => String(entry.id) === String(serverItem.id) && String(entry.id) !== tempId
      );

      if (existingServerIndex !== -1) {
        const existingServerItem = caja.cartItems[existingServerIndex];
        existingServerItem.quantity += Number(optimisticItem.quantity || 1);
        existingServerItem.scannedAt = optimisticItem.scannedAt || existingServerItem.scannedAt;
        caja.cartItems.splice(optimisticIndex, 1);
        caja.lastScannedItemId = existingServerItem.id;
        caja.lastScannedAt = existingServerItem.scannedAt || caja.lastScannedAt;
        persistScannerState(state);
        return;
      }

      caja.cartItems[optimisticIndex] = {
        ...serverItem,
        quantity: Number(optimisticItem.quantity || 1),
        scannedAt: optimisticItem.scannedAt,
        isQuickAddPending: false,
        quickAddSyncError: ''
      };
      caja.lastScannedItemId = serverItem.id;
      caja.lastScannedAt = optimisticItem.scannedAt || caja.lastScannedAt;
      persistScannerState(state);
    },
    clearCart(state) {
      const caja = state.cajas[state.activeCajaId];
      caja.cartItems = [];
      caja.scanStatus = 'idle';
      caja.scanError = '';
      caja.scanBarcode = '';
      caja.lastScannedItemId = null;
      caja.lastScannedAt = null;
      persistScannerState(state);
    },
    setLiveEditor(state, action) {
      const caja = state.cajas[state.activeCajaId];
      const payload = action.payload || {};
      caja.liveEditor = {
        type: payload.type || 'manual',
        title: payload.title || '',
        description: payload.description || '',
        draft: payload.draft || null
      };
      persistScannerState(state);
    },
    updateLiveEditorDraft(state, action) {
      const caja = state.cajas[state.activeCajaId];
      if (!caja.liveEditor) {
        return;
      }
      caja.liveEditor.draft = {
        ...(caja.liveEditor.draft || {}),
        ...(action.payload || {})
      };
      persistScannerState(state);
    },
    clearLiveEditor(state) {
      state.cajas[state.activeCajaId].liveEditor = null;
      persistScannerState(state);
    },
    resetScannerState() {
      const nextState = {
        activeCajaId: 'caja1',
        cajas: createEmptyCajasState()
      };
      persistScannerState(nextState);
      return nextState;
    }
  }
});

export const {
  setActiveCaja,
  setScanBarcode,
  setScanLoading,
  addScannedProduct,
  setScanError,
  decrementCartItem,
  updateCartItem,
  setQuickAddSyncState,
  reconcileQuickAddProduct,
  clearCart,
  resetScannerState,
  setLiveEditor,
  updateLiveEditorDraft,
  clearLiveEditor
} = scannerSlice.actions;

export const selectActiveCajaId = (state) => state.scanner.activeCajaId;
export const selectScannerCartItems = (state) => state.scanner.cajas[state.scanner.activeCajaId].cartItems;
export const selectScannerTotals = createSelector(
  [selectScannerCartItems],
  (cartItems) => calculateTotals(cartItems)
);
export const selectCajaSummaries = createSelector(
  [(state) => state.scanner.cajas, (state) => state.scanner.activeCajaId],
  (cajas, activeCajaId) => CAJA_IDS.map((cajaId) => ({
    id: cajaId,
    label: CAJA_LABELS[cajaId] || cajaId,
    itemCount: calculateTotals(cajas?.[cajaId]?.cartItems || []).items,
    isActive: cajaId === activeCajaId
  }))
);

export default scannerSlice.reducer;
