import { useDispatch, useSelector } from 'react-redux';
import {
  addScannedProduct,
  clearCart,
  setScanBarcode,
  setScanError,
  setScanLoading
} from '../scannerSlice';
import { fetchProductByBarcode } from '../services/scanner.api';

export function useScannerController() {
  const dispatch = useDispatch();
  const scannerState = useSelector((state) => state.scanner);

  async function scanCurrentBarcode() {
    dispatch(setScanLoading());
    try {
      const data = await fetchProductByBarcode(scannerState.scanBarcode);
      dispatch(addScannedProduct(data.item));
    } catch (error) {
      dispatch(setScanError(error.message || 'No se pudo escanear'));
    }
  }

  function openManualProduct() {
    const rawValue = window.prompt('Ingresa el valor del Producto Manual');
    if (rawValue === null) {
      return;
    }

    const normalized = String(rawValue).replace(',', '.').trim();
    const manualPrice = Number(normalized);

    if (!Number.isFinite(manualPrice) || manualPrice <= 0) {
      dispatch(setScanError('Ingresa un valor numerico valido mayor a 0.'));
      return;
    }

    dispatch(
      addScannedProduct({
        id: `manual-${Date.now()}`,
        nombre: 'Producto Manual',
        precio_venta: Number(manualPrice.toFixed(2)),
        stock_actual: 0,
        categoria: 'manual',
        barcode: '',
        barcode_normalized: '',
        tiene_imagen: false,
        thumbnail_url: null
      })
    );
  }

  function chargeCart() {
    dispatch(clearCart());
  }

  return {
    scannerState,
    actions: {
      scanCurrentBarcode,
      openManualProduct,
      chargeCart,
      setScanBarcode: (value) => dispatch(setScanBarcode(value))
    }
  };
}
