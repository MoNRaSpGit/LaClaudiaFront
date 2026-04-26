import { useDispatch, useSelector } from 'react-redux';
import {
  addScannedProduct,
  clearLiveEditor,
  clearCart,
  decrementCartItem,
  selectScannerTotals,
  setScanBarcode,
  setScanError,
  setLiveEditor,
  setScanLoading,
  updateLiveEditorDraft
} from '../scannerSlice';
import { fetchProductByBarcode } from '../services/scanner.api';
import { confirmSale } from '../../panelControl/panelControlSlice';

export function useScannerController() {
  const dispatch = useDispatch();
  const scannerState = useSelector((state) => state.scanner);
  const totals = useSelector(selectScannerTotals);

  async function scanCurrentBarcode() {
    dispatch(setScanLoading());
    try {
      const data = await fetchProductByBarcode(scannerState.scanBarcode);
      dispatch(addScannedProduct(data.item));
    } catch (error) {
      dispatch(setScanError(error.message || 'No se pudo escanear'));
    }
  }

  function addManualProduct(rawValue) {
    const normalized = String(rawValue).replace(',', '.').trim();
    const manualPrice = Number(normalized);

    if (!Number.isFinite(manualPrice) || manualPrice <= 0) {
      dispatch(setScanError('Ingresa un valor numerico valido mayor a 0.'));
      return false;
    }

    dispatch(
      addScannedProduct({
        id: `manual-line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: null,
        isManual: true,
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

    return true;
  }

  function chargeCart() {
    const snapshotItems = scannerState.cartItems.map((item) => ({
      id: item.id,
      productId: item.isManual ? null : (item.productId ?? item.id),
      isManual: Boolean(item.isManual),
      nombre: item.nombre,
      precio_venta: Number(item.precio_venta || 0),
      quantity: Number(item.quantity || 1),
      thumbnail_url: item.thumbnail_url || null
    }));

    if (snapshotItems.length > 0) {
      dispatch(
        confirmSale({
          id: `sale-${Date.now()}`,
          items: snapshotItems,
          total: Number(totals.total || 0),
          createdAt: new Date().toISOString()
        })
      );
    }

    dispatch(clearCart());
  }

  return {
    scannerState,
    totals,
    actions: {
      scanCurrentBarcode,
      addManualProduct,
      chargeCart,
      removeOneFromCart: (id) => dispatch(decrementCartItem(id)),
      setScanBarcode: (value) => dispatch(setScanBarcode(value)),
      startManualLiveEditor: () => dispatch(
        setLiveEditor({
          type: 'manual',
          title: 'Producto manual',
          description: 'El operario esta cargando un producto manualmente. La caja lo ve en vivo mientras el modal sigue abierto.',
          draft: { nombre: 'Producto Manual', precio_venta_raw: '', precio_venta: 0 }
        })
      ),
      startProductEditLiveEditor: (item) => dispatch(
        setLiveEditor({
          type: 'edit',
          title: 'Editando producto',
          description: 'La caja ve en vivo los cambios del producto mientras el modal sigue abierto.',
          draft: {
            id: item?.id,
            nombre: item?.nombre || '',
            precio_venta_raw: item?.precio_venta != null ? String(item.precio_venta) : '',
            precio_venta: Number(item?.precio_venta || 0),
            thumbnail_url: item?.thumbnail_url || ''
          }
        })
      ),
      updateLiveEditorDraft: (draft) => dispatch(updateLiveEditorDraft(draft)),
      stopLiveEditor: () => dispatch(clearLiveEditor())
    }
  };
}
