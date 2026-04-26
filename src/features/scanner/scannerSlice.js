import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  quickProductsStatus: 'idle',
  quickProductsError: '',
  quickProducts: [],
  scanBarcode: '',
  scanStatus: 'idle',
  scanError: '',
  cartItems: [],
  lastScannedItemId: null
};

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
  initialState,
  reducers: {
    setQuickProductsLoading(state) {
      state.quickProductsStatus = 'loading';
      state.quickProductsError = '';
    },
    setQuickProductsSuccess(state, action) {
      state.quickProductsStatus = 'ready';
      state.quickProducts = Array.isArray(action.payload) ? action.payload : [];
      state.quickProductsError = '';
    },
    setQuickProductsError(state, action) {
      state.quickProductsStatus = 'error';
      state.quickProductsError = action.payload;
    },
    setScanBarcode(state, action) {
      state.scanBarcode = action.payload;
    },
    setScanLoading(state) {
      state.scanStatus = 'loading';
      state.scanError = '';
    },
    addScannedProduct(state, action) {
      const product = action.payload;
      state.scanStatus = 'ok';
      state.scanError = '';
      state.scanBarcode = '';

      const existing = state.cartItems.find((item) => String(item.id) === String(product.id));
      if (existing) {
        existing.quantity += 1;
        state.lastScannedItemId = existing.id;
      } else {
        state.cartItems.push({
          ...product,
          quantity: 1,
          scannedAt: new Date().toISOString()
        });
        state.lastScannedItemId = product.id;
      }
    },
    setScanError(state, action) {
      state.scanStatus = 'error';
      state.scanError = action.payload;
    },
    incrementCartItem(state, action) {
      const itemId = String(action.payload);
      const item = state.cartItems.find((entry) => String(entry.id) === itemId);
      if (item) {
        item.quantity += 1;
      }
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
    },
    removeCartItem(state, action) {
      const itemId = String(action.payload);
      state.cartItems = state.cartItems.filter((entry) => String(entry.id) !== itemId);
    },
    clearCart(state) {
      state.cartItems = [];
      state.scanStatus = 'idle';
      state.scanError = '';
      state.scanBarcode = '';
      state.lastScannedItemId = null;
    }
  }
});

export const {
  setQuickProductsLoading,
  setQuickProductsSuccess,
  setQuickProductsError,
  setScanBarcode,
  setScanLoading,
  addScannedProduct,
  setScanError,
  incrementCartItem,
  decrementCartItem,
  removeCartItem,
  clearCart
} = scannerSlice.actions;

export const selectScannerTotals = (state) => calculateTotals(state.scanner.cartItems);

export default scannerSlice.reducer;
