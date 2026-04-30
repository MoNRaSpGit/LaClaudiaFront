import { useCallback } from 'react';
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
  updateCartItem,
  updateLiveEditorDraft
} from '../scannerSlice';
import { createScannerProduct, fetchProductByBarcode, updateScannerProduct } from '../services/scanner.api';
import { enqueueScannerSale } from '../services/scanner.salesQueue';
import { parsePositiveAmount } from '../../../shared/lib/number';
import { toUserErrorMessage } from '../../../shared/lib/userErrorMessages';

export function useScannerController({ currentUser } = {}) {
  const dispatch = useDispatch();
  const scannerState = useSelector((state) => state.scanner);
  const totals = useSelector(selectScannerTotals);

  function isBarcodeNotFoundError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('no encontrado') || message.includes('404');
  }

  async function scanCurrentBarcode() {
    const normalizedBarcode = String(scannerState.scanBarcode || '').trim();
    if (!normalizedBarcode) {
      dispatch(setScanError('Ingresa un barcode valido para escanear.'));
      return { ok: false, code: 'EMPTY_BARCODE' };
    }

    dispatch(setScanLoading());
    try {
      const data = await fetchProductByBarcode(normalizedBarcode);
      dispatch(addScannedProduct(data.item));
      return { ok: true };
    } catch (error) {
      if (isBarcodeNotFoundError(error)) {
        dispatch(setScanError(`Barcode ${normalizedBarcode} no encontrado. Carga rapida habilitada.`));
        return {
          ok: false,
          code: 'NOT_FOUND',
          barcode: normalizedBarcode
        };
      }
      dispatch(setScanError(toUserErrorMessage(error, { context: 'scanner_lookup' })));
      return { ok: false, code: 'UNKNOWN_ERROR' };
    }
  }

  function addManualProduct(rawValue) {
    const manualPrice = parsePositiveAmount(rawValue);

    if (manualPrice === null) {
      dispatch(setScanError('Ingresa un valor numerico valido mayor a 0.'));
      return false;
    }

    dispatch(
      addScannedProduct({
        id: `manual-line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: null,
        isManual: true,
        nombre: 'Producto Manual',
        precio_venta: manualPrice,
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

  async function addQuickBarcodeProduct({ barcode, rawValue }) {
    const manualPrice = parsePositiveAmount(rawValue);
    if (manualPrice === null) {
      dispatch(setScanError('Ingresa un valor numerico valido mayor a 0.'));
      return false;
    }

    const normalizedBarcode = String(barcode || '').trim();
    const normalizedName = 'Producto Manual';

    try {
      const data = await createScannerProduct(
        {
          barcode: normalizedBarcode,
          nombre: normalizedName,
          precio_venta: manualPrice
        },
        { token: currentUser?.sessionToken || '' }
      );

      dispatch(addScannedProduct(data.item));
      return true;
    } catch (error) {
      dispatch(setScanError(toUserErrorMessage(error, { context: 'scanner_edit' })));
      return false;
    }
  }

  async function chargeCart() {
    const snapshotItems = scannerState.cartItems.map((item) => ({
      id: item.id,
      productId: item.isManual ? null : (item.productId ?? item.id),
      isManual: Boolean(item.isManual),
      nombre: item.nombre,
      precio_venta: Number(item.precio_venta || 0),
      quantity: Number(item.quantity || 1),
      thumbnail_url: item.thumbnail_url || null
    }));

    if (!snapshotItems.length) {
      dispatch(clearCart());
      return { ok: false, code: 'EMPTY_CART' };
    }

    const chargedAtIso = new Date().toISOString();
    const externalId = `sale-${Date.now()}`;
    const payload = {
      externalId,
      userId: currentUser?.id || null,
      items: snapshotItems
    };

    // Fast path: caja no espera red para cerrar el cobro.
    dispatch(clearCart());
    enqueueScannerSale({
      payload,
      token: currentUser?.sessionToken || ''
    });

    return {
      ok: true,
      ticket: {
        externalId,
        chargedAtIso,
        operatorName: currentUser?.display_name || currentUser?.username || 'Operario',
        items: snapshotItems,
        total: snapshotItems.reduce((sum, item) => sum + Number(item.precio_venta || 0) * Number(item.quantity || 1), 0)
      }
    };
  }

  async function applyCartItemEdit(payload) {
    const normalizedPayload = payload || {};
    dispatch(updateCartItem(normalizedPayload));

    const isManual = Boolean(normalizedPayload.isManual);
    const candidateProductId = Number(normalizedPayload.productId ?? normalizedPayload.id);
    const hasValidProductId = Number.isInteger(candidateProductId) && candidateProductId > 0;

    if (isManual || !hasValidProductId) {
      return true;
    }

    try {
      await updateScannerProduct(
        candidateProductId,
        {
          nombre: normalizedPayload.nombre,
          precio_venta: Number(normalizedPayload.precio_venta || 0),
          thumbnail_url: normalizedPayload.thumbnail_url ?? null
        },
        { token: currentUser?.sessionToken || '' }
      );
      return true;
    } catch (error) {
      dispatch(setScanError(toUserErrorMessage(error, { context: 'scanner_edit' })));
      // El cambio local ya se aplico en carrito; no bloquear el cierre del modal.
      return true;
    }
  }

  const addOneToCart = useCallback((item) => dispatch(addScannedProduct(item)), [dispatch]);
  const removeOneFromCart = useCallback((id) => dispatch(decrementCartItem(id)), [dispatch]);
  const setScanBarcodeValue = useCallback((value) => dispatch(setScanBarcode(value)), [dispatch]);
  const clearScanErrorNow = useCallback(() => dispatch(setScanError('')), [dispatch]);
  const clearCartNow = useCallback(() => dispatch(clearCart()), [dispatch]);
  const startManualLiveEditor = useCallback(() => dispatch(
    setLiveEditor({
      type: 'manual',
      title: 'Producto manual',
      description: 'El operario esta cargando un producto manualmente. La caja lo ve en vivo mientras el modal sigue abierto.',
      draft: { nombre: 'Producto Manual', precio_venta_raw: '', precio_venta: 0 }
    })
  ), [dispatch]);
  const startProductEditLiveEditor = useCallback((item) => dispatch(
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
  ), [dispatch]);
  const startQuickBarcodeLiveEditor = useCallback(({ barcode }) => dispatch(
    setLiveEditor({
      type: 'quick_add',
      title: 'Barcode no encontrado',
      description: 'Alta rapida en caja sin cortar flujo.',
      draft: {
        barcode: String(barcode || ''),
        nombre: 'Producto Manual',
        precio_venta_raw: '',
        precio_venta: 0
      }
    })
  ), [dispatch]);
  const updateLiveEditorDraftValue = useCallback((draft) => dispatch(updateLiveEditorDraft(draft)), [dispatch]);
  const stopLiveEditor = useCallback(() => dispatch(clearLiveEditor()), [dispatch]);

  return {
    scannerState,
    totals,
    actions: {
      scanCurrentBarcode,
      addManualProduct,
      addQuickBarcodeProduct,
      chargeCart,
      addOneToCart,
      removeOneFromCart,
      applyCartItemEdit,
      setScanBarcode: setScanBarcodeValue,
      clearScanError: clearScanErrorNow,
      clearCartNow,
      startManualLiveEditor,
      startProductEditLiveEditor,
      startQuickBarcodeLiveEditor,
      updateLiveEditorDraft: updateLiveEditorDraftValue,
      stopLiveEditor
    }
  };
}
