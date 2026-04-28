import { createSelector, createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'scanner_state_v1';

const initialState = {
  scanBarcode: '',
  scanStatus: 'idle',
  scanError: '',
  cartItems: [],
  lastScannedItemId: null,
  lastScannedAt: null,
  liveEditor: null,
  productOverrides: {}
};

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

    return {
      ...initialState,
      ...parsed,
      scanStatus: 'idle',
      scanError: '',
      scanBarcode: ''
    };
  } catch (_error) {
    return null;
  }
}

function persistScannerState(state) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  const payload = {
    cartItems: Array.isArray(state.cartItems) ? state.cartItems : [],
    lastScannedItemId: state.lastScannedItemId || null,
    lastScannedAt: state.lastScannedAt || null,
    liveEditor: state.liveEditor || null,
    productOverrides: state.productOverrides || {}
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore persistence errors to keep scanner flow uninterrupted.
  }
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

function getProductOverrideKey(product = {}) {
  if (product?.isManual) {
    return '';
  }

  if (product?.productId != null && String(product.productId).trim() !== '') {
    return `product:${String(product.productId).trim()}`;
  }

  if (product?.id != null && String(product.id).trim() !== '') {
    return `product:${String(product.id).trim()}`;
  }

  const normalizedBarcode = String(product?.barcode_normalized || '').trim();
  if (normalizedBarcode) {
    return `barcode:${normalizedBarcode}`;
  }

  const barcode = String(product?.barcode || '').trim();
  if (barcode) {
    return `barcode:${barcode}`;
  }

  return '';
}

function applyProductOverride(product, override) {
  if (!override) {
    return product;
  }

  return {
    ...product,
    nombre: override.nombre != null ? override.nombre : product.nombre,
    precio_venta: override.precio_venta != null ? override.precio_venta : product.precio_venta,
    thumbnail_url: override.thumbnail_url !== undefined ? override.thumbnail_url : product.thumbnail_url
  };
}

const scannerSlice = createSlice({
  name: 'scanner',
  initialState: hydratedInitialState,
  reducers: {
    setScanBarcode(state, action) {
      state.scanBarcode = action.payload;
    },
    setScanLoading(state) {
      state.scanStatus = 'loading';
      state.scanError = '';
      persistScannerState(state);
    },
    addScannedProduct(state, action) {
      const sourceProduct = action.payload || {};
      const overrideKey = getProductOverrideKey(sourceProduct);
      const product = applyProductOverride(sourceProduct, overrideKey ? state.productOverrides[overrideKey] : null);
      state.scanStatus = 'ok';
      state.scanError = '';
      state.scanBarcode = '';

      const existing = state.cartItems.find((item) => String(item.id) === String(product.id));
      if (existing) {
        existing.quantity += 1;
        existing.scannedAt = new Date().toISOString();
        state.lastScannedItemId = existing.id;
        state.lastScannedAt = existing.scannedAt;
        persistScannerState(state);
        return;
      }

      const scannedAt = new Date().toISOString();
      state.cartItems.push({
        ...product,
        quantity: 1,
        scannedAt
      });
      state.lastScannedItemId = product.id;
      state.lastScannedAt = scannedAt;
      persistScannerState(state);
    },
    setScanError(state, action) {
      state.scanStatus = 'error';
      state.scanError = action.payload;
      persistScannerState(state);
    },
    decrementCartItem(state, action) {
      const itemId = String(action.payload);
      const item = state.cartItems.find((entry) => String(entry.id) === itemId);
      if (!item) {
        return;
      }
      item.quantity -= 1;
      if (item.quantity <= 0) {
        state.cartItems = state.cartItems.filter((entry) => String(entry.id) !== itemId);
      }
      persistScannerState(state);
    },
    updateCartItem(state, action) {
      const payload = action.payload || {};
      const itemId = String(payload.id || '');
      const item = state.cartItems.find((entry) => String(entry.id) === itemId);
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

      const overrideKey = getProductOverrideKey(item);
      if (overrideKey) {
        state.productOverrides[overrideKey] = {
          nombre: item.nombre,
          precio_venta: item.precio_venta,
          thumbnail_url: item.thumbnail_url || null
        };
      }
      persistScannerState(state);
    },
    clearCart(state) {
      state.cartItems = [];
      state.scanStatus = 'idle';
      state.scanError = '';
      state.scanBarcode = '';
      state.lastScannedItemId = null;
      state.lastScannedAt = null;
      persistScannerState(state);
    },
    setLiveEditor(state, action) {
      const payload = action.payload || {};
      state.liveEditor = {
        type: payload.type || 'manual',
        title: payload.title || '',
        description: payload.description || '',
        draft: payload.draft || null
      };
      persistScannerState(state);
    },
    updateLiveEditorDraft(state, action) {
      if (!state.liveEditor) {
        return;
      }
      state.liveEditor.draft = {
        ...(state.liveEditor.draft || {}),
        ...(action.payload || {})
      };
      persistScannerState(state);
    },
    clearLiveEditor(state) {
      state.liveEditor = null;
      persistScannerState(state);
    },
    resetScannerState() {
      const nextState = { ...initialState };
      persistScannerState(nextState);
      return nextState;
    }
  }
});

export const {
  setScanBarcode,
  setScanLoading,
  addScannedProduct,
  setScanError,
  decrementCartItem,
  updateCartItem,
  clearCart,
  resetScannerState,
  setLiveEditor,
  updateLiveEditorDraft,
  clearLiveEditor
} = scannerSlice.actions;

export const selectScannerCartItems = (state) => state.scanner.cartItems;
export const selectScannerTotals = createSelector(
  [selectScannerCartItems],
  (cartItems) => calculateTotals(cartItems)
);

export default scannerSlice.reducer;
