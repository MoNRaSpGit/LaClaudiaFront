import { useCallback, useEffect, useRef, useState } from 'react';
import { useScannerController } from './model/useScannerController';
import ScannerInput from './components/ScannerInput';
import ScannerCart from './components/ScannerCart';
import ScannerCheckout from './components/ScannerCheckout';
import ScannerManualModal from './components/ScannerManualModal';
import ScannerQuickAddModal from './components/ScannerQuickAddModal';
import { publishScannerLiveState } from './services/scanner.api';
import {
  flushScannerSalesQueue,
  getScannerSalesQueuePendingCount,
  subscribeScannerSalesQueue
} from './services/scanner.salesQueue';

function ScannerFeature({ currentUser }) {
  const { scannerState, totals, actions } = useScannerController({ currentUser });
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [quickAddState, setQuickAddState] = useState({
    isOpen: false,
    barcode: ''
  });
  const [pendingSalesCount, setPendingSalesCount] = useState(getScannerSalesQueuePendingCount());
  const scannerInputRef = useRef(null);

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
    if (!currentUser?.sessionToken) {
      return;
    }

    const timeoutId = setTimeout(() => {
      publishScannerLiveState({
        items: scannerState.cartItems.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          quantity: Number(item.quantity || 1),
          precio_venta: Number(item.precio_venta || 0)
        })),
        lastScannedAt: scannerState.lastScannedAt || null,
        liveEditor: scannerState.liveEditor || null
      }, {
        token: currentUser.sessionToken
      }).catch(() => {});
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [
    currentUser?.sessionToken,
    scannerState.cartItems,
    scannerState.lastScannedAt,
    scannerState.liveEditor
  ]);

  const handleManualValueChange = useCallback(
    (rawValue) => {
      actions.updateLiveEditorDraft({
        nombre: 'Producto Manual',
        precio_venta_raw: String(rawValue || ''),
        precio_venta: Number(String(rawValue || '').replace(',', '.')) || 0
      });
    },
    [actions]
  );

  function closeManualModal() {
    setIsManualModalOpen(false);
    actions.stopLiveEditor();
    focusScannerInput();
  }

  function closeQuickAddModal() {
    setQuickAddState({
      isOpen: false,
      barcode: ''
    });
    actions.stopLiveEditor();
    focusScannerInput();
  }

  async function handleScanSubmit() {
    const scanResult = await actions.scanCurrentBarcode();
    if (scanResult?.code !== 'NOT_FOUND') {
      return;
    }

    const barcode = String(scanResult.barcode || '').trim();
    actions.startQuickBarcodeLiveEditor({
      barcode
    });
    setQuickAddState({
      isOpen: true,
      barcode
    });
  }

  return (
    <>
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-9">
            <ScannerInput
              ref={scannerInputRef}
              barcode={scannerState.scanBarcode}
              scanStatus={scannerState.scanStatus}
              scanError={scannerState.scanError}
              onBarcodeChange={actions.setScanBarcode}
              onSubmit={handleScanSubmit}
            />

            <div className="text-center mt-4">
              <button
                type="button"
                className="btn scanner-manual-btn"
                onClick={() => {
                  actions.startManualLiveEditor();
                  setIsManualModalOpen(true);
                }}
              >
                Producto manual
              </button>
            </div>

            <ScannerCart
              items={scannerState.cartItems}
              lastScannedItemId={scannerState.lastScannedItemId}
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
                onCharge={async () => {
                  const ok = await actions.chargeCart();
                  focusScannerInput();
                  return ok;
                }}
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
      />

      <ScannerQuickAddModal
        isOpen={quickAddState.isOpen}
        barcode={quickAddState.barcode}
        onClose={closeQuickAddModal}
        onConfirm={actions.addQuickBarcodeProduct}
        onDraftChange={actions.updateLiveEditorDraft}
      />
    </>
  );
}

export default ScannerFeature;
