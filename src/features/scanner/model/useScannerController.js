import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setApiChecking, setApiError, setApiSuccess } from '../../app/appSlice';
import {
  addScannedProduct,
  clearCart,
  decrementCartItem,
  incrementCartItem,
  removeCartItem,
  setQuickProductsError,
  setQuickProductsLoading,
  setQuickProductsSuccess,
  setScanBarcode,
  setScanError,
  setScanLoading,
  selectScannerTotals
} from '../scannerSlice';
import { apiUrl, fetchHealth, fetchInitialProducts, fetchProductByBarcode } from '../services/scanner.api';

export function useScannerController() {
  const dispatch = useDispatch();
  const appState = useSelector((state) => state.app);
  const scannerState = useSelector((state) => state.scanner);
  const totals = useSelector(selectScannerTotals);

  const apiBadgeClass = useMemo(() => {
    if (appState.apiStatus === 'online') return 'bg-success';
    if (appState.apiStatus === 'offline') return 'bg-danger';
    if (appState.apiStatus === 'checking') return 'bg-warning text-dark';
    return 'bg-secondary';
  }, [appState.apiStatus]);

  async function checkBackend() {
    dispatch(setApiChecking());
    try {
      const data = await fetchHealth();
      dispatch(setApiSuccess(data.message || 'Backend online'));
    } catch (error) {
      dispatch(setApiError(error.message || 'No se pudo conectar al backend'));
    }
  }

  async function loadQuickProducts() {
    dispatch(setQuickProductsLoading());
    try {
      const data = await fetchInitialProducts(5);
      dispatch(setQuickProductsSuccess(data.items || []));
    } catch (error) {
      dispatch(setQuickProductsError(error.message || 'No se pudieron cargar productos'));
    }
  }

  async function scanCurrentBarcode() {
    dispatch(setScanLoading());
    try {
      const data = await fetchProductByBarcode(scannerState.scanBarcode);
      dispatch(addScannedProduct(data.item));
    } catch (error) {
      dispatch(setScanError(error.message || 'No se pudo escanear'));
    }
  }

  return {
    apiUrl,
    appState,
    scannerState,
    totals,
    apiBadgeClass,
    actions: {
      checkBackend,
      loadQuickProducts,
      scanCurrentBarcode,
      setScanBarcode: (value) => dispatch(setScanBarcode(value)),
      incrementCartItem: (id) => dispatch(incrementCartItem(id)),
      decrementCartItem: (id) => dispatch(decrementCartItem(id)),
      removeCartItem: (id) => dispatch(removeCartItem(id)),
      clearCart: () => dispatch(clearCart())
    }
  };
}
