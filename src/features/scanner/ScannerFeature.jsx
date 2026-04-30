import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { useScannerController } from './model/useScannerController';
import ScannerInput from './components/ScannerInput';
import ScannerCart from './components/ScannerCart';
import ScannerCheckout from './components/ScannerCheckout';
import ScannerManualModal from './components/ScannerManualModal';
import ScannerQuickAddModal from './components/ScannerQuickAddModal';
import { publishScannerLiveState } from './services/scanner.api';
import { printSaleTicket } from './services/scanner.print';
import { printSaleTicketByQz } from './services/scanner.qzPrint';
import {
  flushScannerSalesQueue,
  getScannerSalesQueuePendingCount,
  subscribeScannerSalesQueue,
  subscribeScannerSalesQueueErrors
} from './services/scanner.salesQueue';

const SALE_SYNC_ERROR_TOAST_COOLDOWN_MS = 30000;
const POST_CHARGE_ENTER_GUARD_MS = 1200;
const LIVE_STATE_PUBLISH_DELAY_MS = 100;
const LIVE_STATE_SLOW_MS = 300;

function ScannerFeature({ currentUser }) {
  const { scannerState, totals, actions } = useScannerController({ currentUser });
  const updateLiveEditorDraft = actions.updateLiveEditorDraft;
  const clearScanError = actions.clearScanError;
  const stopLiveEditor = actions.stopLiveEditor;
  const startManualLiveEditor = actions.startManualLiveEditor;
  const startQuickBarcodeLiveEditor = actions.startQuickBarcodeLiveEditor;
  const isOperario = String(currentUser?.role || '').trim().toLowerCase() === 'operario';
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [quickAddState, setQuickAddState] = useState({
    isOpen: false,
    barcode: ''
  });
  const [pendingSalesCount, setPendingSalesCount] = useState(getScannerSalesQueuePendingCount());
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [openConfirmSignal, setOpenConfirmSignal] = useState(0);
  const [confirmByEnterSignal, setConfirmByEnterSignal] = useState(0);
  const scannerInputRef = useRef(null);
  const lastSyncErrorToastAtRef = useRef(0);
  const lastChargeAtRef = useRef(0);
  const lastLiveStateSignatureRef = useRef('');

  const focusScannerInput = useCallback(() => {
    setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeScannerSalesQueue((pending) => {
      setPendingSalesCount(pending);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    focusScannerInput();
    flushScannerSalesQueue({
      token: currentUser?.sessionToken || ''
    }).catch(() => {});
  }, [currentUser?.sessionToken, focusScannerInput]);

  useEffect(() => {
    if (isManualModalOpen) {
      return;
    }
    if (scannerState.scanStatus !== 'loading') {
      focusScannerInput();
    }
  }, [focusScannerInput, isManualModalOpen, scannerState.scanStatus]);

  useEffect(() => {
    function handleOnline() {
      flushScannerSalesQueue({
        token: currentUser?.sessionToken || ''
      }).catch(() => {});
    }

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser?.sessionToken]);

  useEffect(() => {
    const unsubscribeErrors = subscribeScannerSalesQueueErrors(() => {
      const now = Date.now();
      if (now - lastSyncErrorToastAtRef.current < SALE_SYNC_ERROR_TOAST_COOLDOWN_MS) {
        return;
      }
      lastSyncErrorToastAtRef.current = now;
      toast.error('Hubo un error en la ultima compra. Se reintentara en segundo plano.', {
        toastId: 'scanner-sale-sync-error',
        autoClose: 3500
      });
    });

    return () => {
      unsubscribeErrors();
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.sessionToken || !isOperario) {
      return;
    }

    const liveStatePayload = {
      items: scannerState.cartItems.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        quantity: Number(item.quantity || 1),
        precio_venta: Number(item.precio_venta || 0)
      })),
      lastScannedAt: scannerState.lastScannedAt || null,
      liveEditor: scannerState.liveEditor || null
    };
    const nextSignature = JSON.stringify(liveStatePayload);
    if (nextSignature === lastLiveStateSignatureRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      lastLiveStateSignatureRef.current = nextSignature;
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      publishScannerLiveState(liveStatePayload, {
        token: currentUser.sessionToken
      })
        .then(() => {
          const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
          const rounded = Number(elapsedMs.toFixed(1));
          if (rounded > LIVE_STATE_SLOW_MS) {
            console.warn(`[LIVE_STATE][LENTO] publish=${rounded} ms (> ${LIVE_STATE_SLOW_MS} ms)`);
          } else {
            console.info(`[LIVE_STATE][OK] publish=${rounded} ms`);
          }
        })
        .catch(() => {});
    }, LIVE_STATE_PUBLISH_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [
    currentUser?.sessionToken,
    isOperario,
    scannerState.cartItems,
    scannerState.lastScannedAt,
    scannerState.liveEditor
  ]);

  useEffect(() => {
    if (!currentUser?.sessionToken || !isOperario) {
      return;
    }

    return () => {
      lastLiveStateSignatureRef.current = '';
      publishScannerLiveState({
        items: [],
        lastScannedAt: null,
        liveEditor: null
      }, {
        token: currentUser.sessionToken
      }).catch(() => {});
    };
  }, [currentUser?.sessionToken, isOperario]);

  useEffect(() => {
    if (scannerState.cartItems.length > 0) {
      return;
    }
    setIsCheckoutConfirmOpen(false);
    setOpenConfirmSignal(0);
    setConfirmByEnterSignal(0);
  }, [scannerState.cartItems.length]);

  const handleManualValueChange = useCallback(
    (rawValue) => {
      updateLiveEditorDraft({
        nombre: 'Producto Manual',
        precio_venta_raw: String(rawValue || ''),
        precio_venta: Number(String(rawValue || '').replace(',', '.')) || 0
      });
    },
    [updateLiveEditorDraft]
  );

  function closeManualModal() {
    setIsManualModalOpen(false);
    clearScanError();
    stopLiveEditor();
    focusScannerInput();
  }

  function closeQuickAddModal() {
    setQuickAddState({
      isOpen: false,
      barcode: ''
    });
    stopLiveEditor();
    focusScannerInput();
  }

  const executeCharge = useCallback(async () => {
    const result = await actions.chargeCart();
    if (result?.ok) {
      lastChargeAtRef.current = Date.now();
      setIsCheckoutConfirmOpen(false);
      setOpenConfirmSignal(0);
      setConfirmByEnterSignal(0);
      toast.success('Compra confirmada', {
        toastId: `scanner-sale-ok-${Date.now()}`,
        autoClose: 1800
      });

      const ticketPayload = {
        ...result.ticket,
        storeName: 'Super Nova'
      };

      try {
        await printSaleTicketByQz(ticketPayload);
      } catch (error) {
        try {
          await printSaleTicket(ticketPayload);
          toast.warn('QZ fallo, se abrio impresion del navegador como respaldo.', {
            toastId: `scanner-print-fallback-${Date.now()}`,
            autoClose: 2600
          });
        } catch {
          toast.error(`No se pudo imprimir: ${error?.message || 'Error de QZ.'}`, {
            toastId: `scanner-print-fail-${Date.now()}`,
            autoClose: 3200
          });
        }
      }
    }
    focusScannerInput();
    return Boolean(result?.ok);
  }, [actions, focusScannerInput]);

  async function handleScanSubmit() {
    const normalizedBarcode = String(scannerState.scanBarcode || '').trim();
    if (!normalizedBarcode) {
      if (!scannerState.cartItems.length) {
        return;
      }
      if (Date.now() - lastChargeAtRef.current < POST_CHARGE_ENTER_GUARD_MS) {
        return;
      }
      if (!isCheckoutConfirmOpen) {
        setOpenConfirmSignal((value) => value + 1);
        return;
      }
      setConfirmByEnterSignal((value) => value + 1);
      return;
    }

    const scanResult = await actions.scanCurrentBarcode();
    if (scanResult?.code !== 'NOT_FOUND') {
      return;
    }

    const barcode = String(scanResult.barcode || '').trim();
    clearScanError();
    startQuickBarcodeLiveEditor({
      barcode
    });
    setQuickAddState({
      isOpen: true,
      barcode
    });
  }

  const modalErrorMessage = isManualModalOpen ? scannerState.scanError : '';
  const quickAddErrorMessage = quickAddState.isOpen ? scannerState.scanError : '';

  return (
    <>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-9">
            <ScannerInput
              ref={scannerInputRef}
              barcode={scannerState.scanBarcode}
              scanStatus={scannerState.scanStatus}
              onBarcodeChange={actions.setScanBarcode}
              onSubmit={handleScanSubmit}
            />

            <div className="text-center mt-4">
              <button
                type="button"
                className="btn scanner-manual-btn"
                onClick={() => {
                  clearScanError();
                  startManualLiveEditor();
                  setIsManualModalOpen(true);
                }}
              >
                Producto manual
              </button>
            </div>

            <ScannerCart
              items={scannerState.cartItems}
              lastScannedItemId={scannerState.lastScannedItemId}
              onAddOne={actions.addOneToCart}
              onRemoveOne={actions.removeOneFromCart}
              onEditStart={actions.startProductEditLiveEditor}
              onEditDraftChange={actions.updateLiveEditorDraft}
              onEditApply={actions.applyCartItemEdit}
              onEditClose={actions.stopLiveEditor}
              onRequestScannerFocus={focusScannerInput}
            />

            {scannerState.cartItems.length > 0 ? (
              <ScannerCheckout
                total={totals.total}
                pendingSalesCount={pendingSalesCount}
                onCharge={executeCharge}
                openConfirmSignal={openConfirmSignal}
                confirmByEnterSignal={confirmByEnterSignal}
                onConfirmModalOpenChange={setIsCheckoutConfirmOpen}
              />
            ) : null}
          </div>
        </div>
      </div>

      <ScannerManualModal
        isOpen={isManualModalOpen}
        onClose={closeManualModal}
        onConfirm={actions.addManualProduct}
        onValueChange={handleManualValueChange}
        errorMessage={modalErrorMessage}
      />

      <ScannerQuickAddModal
        isOpen={quickAddState.isOpen}
        barcode={quickAddState.barcode}
        onClose={closeQuickAddModal}
        onConfirm={actions.addQuickBarcodeProduct}
        onDraftChange={actions.updateLiveEditorDraft}
        errorMessage={quickAddErrorMessage}
      />
    </>
  );
}

export default ScannerFeature;
