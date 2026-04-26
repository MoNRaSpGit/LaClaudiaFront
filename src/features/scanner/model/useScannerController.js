import { useDispatch, useSelector } from 'react-redux';
import {
  addScannedProduct,
  setScanBarcode,
  setScanError,
  setScanLoading
} from '../scannerSlice';
import { apiUrl, fetchProductByBarcode } from '../services/scanner.api';

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
    dispatch(setScanError('Carga manual: la vamos a implementar en el siguiente paso.'));
  }

  return {
    apiUrl,
    scannerState,
    actions: {
      scanCurrentBarcode,
      openManualProduct,
      setScanBarcode: (value) => dispatch(setScanBarcode(value))
    }
  };
}
