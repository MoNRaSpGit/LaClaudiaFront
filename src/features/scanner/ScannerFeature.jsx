import { useCallback, useEffect, useRef, useState } from 'react';
import { Apple, Beef, CircleEllipsis, Cog, Scale, Wheat, X } from 'lucide-react';
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
  getScannerSalesQueueDebugSnapshot,
  getScannerSalesQueuePendingCount,
  subscribeScannerSalesQueue,
  subscribeScannerSalesQueueErrors
} from './services/scanner.salesQueue';
import { getMsUntilNextStoreMidnight, getStoreDateLabel } from '../panelControl/model/panelControl.formatters';

const SALE_SYNC_ERROR_TOAST_COOLDOWN_MS = 30000;
const POST_CHARGE_ENTER_GUARD_MS = 1200;
const LIVE_STATE_PUBLISH_DELAY_MS = 100;
const LIVE_STATE_SLOW_MS = 300;
const SCANNER_DIAG_KEY = 'scanner_diag_enabled_v1';
const WORKER_DAY_BANNER_DATE = '2026-05-01';
const WORKER_DAY_BANNER_COPY = {
  quote: 'El placer en el trabajo pone perfeccion en la obra.',
  author: 'Aristoteles'
};
const WORKER_DAY_BANNER_TONES = [
  { key: 'sage', label: 'Verde suave' },
  { key: 'blush', label: 'Rosa suave' },
  { key: 'stone', label: 'Piedra' }
];
const WORKER_DAY_BANNER_GEARS = [
  { key: 'single', label: 'Simple' },
  { key: 'dual-inline', label: 'Doble' },
  { key: 'dual-diagonal', label: 'Diagonal' },
  { key: 'triple', label: 'Triple' },
  { key: 'micro-link', label: 'Fluido' }
];
const MANUAL_PRODUCT_OPTIONS = [
  { key: 'fruta-verduras', label: 'Fruta/Verduras', icon: Apple, category: 'fruta_verduras' },
  { key: 'fiambre', label: 'Fiambre', icon: Beef, category: 'fiambre' },
  { key: 'fideo', label: 'Fideo', icon: Wheat, category: 'fideo' },
  { key: 'producto-x-kg', label: 'Producto x kg', icon: Scale, category: 'producto_x_kg' },
  { key: 'otros', label: 'Otros', icon: CircleEllipsis, category: 'otros' }
];

function ScannerFeature({ currentUser, onUnauthorized }) {
  const { scannerState, totals, actions } = useScannerController({ currentUser });
  const updateLiveEditorDraft = actions.updateLiveEditorDraft;
  const clearScanError = actions.clearScanError;
  const stopLiveEditor = actions.stopLiveEditor;
  const startManualLiveEditor = actions.startManualLiveEditor;
  const startQuickBarcodeLiveEditor = actions.startQuickBarcodeLiveEditor;
  const isOperario = String(currentUser?.role || '').trim().toLowerCase() === 'operario';
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedManualProduct, setSelectedManualProduct] = useState(null);
  const [quickAddState, setQuickAddState] = useState({
    isOpen: false,
    barcode: ''
  });
  const [pendingSalesCount, setPendingSalesCount] = useState(getScannerSalesQueuePendingCount());
  const [currentStoreDateLabel, setCurrentStoreDateLabel] = useState(() => getStoreDateLabel());
  const [isWorkerDayBannerDismissed, setIsWorkerDayBannerDismissed] = useState(false);
  const [workerDayBannerTone] = useState(WORKER_DAY_BANNER_TONES[1].key);
  const [workerDayBannerGearKey] = useState(WORKER_DAY_BANNER_GEARS[4].key);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const fromStorage = String(window.localStorage.getItem(SCANNER_DIAG_KEY) || '').trim();
    const fromQuery = new URLSearchParams(window.location.search).get('diag');
    return fromStorage === '1' || fromQuery === 'scanner';
  });
  const [queueDebugSnapshot, setQueueDebugSnapshot] = useState(() => getScannerSalesQueueDebugSnapshot());
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [openConfirmSignal, setOpenConfirmSignal] = useState(0);
  const [confirmByEnterSignal, setConfirmByEnterSignal] = useState(0);
  const scannerInputRef = useRef(null);
  const lastSyncErrorToastAtRef = useRef(0);
  const syncErrorCountRef = useRef(0);
  const unauthorizedHandledRef = useRef(false);
  const lastChargeAtRef = useRef(0);
  const lastLiveStateSignatureRef = useRef('');
  const isWorkerDayBannerVisible = currentStoreDateLabel === WORKER_DAY_BANNER_DATE && !isWorkerDayBannerDismissed;

  const focusScannerInput = useCallback(() => {
    setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentStoreDateLabel(getStoreDateLabel());
    }, getMsUntilNextStoreMidnight());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentStoreDateLabel]);

  useEffect(() => {
    const unsubscribe = subscribeScannerSalesQueue((pending) => {
      setPendingSalesCount(pending);
      setQueueDebugSnapshot(getScannerSalesQueueDebugSnapshot());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleKeydown(event) {
      if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'd') {
        return;
      }
      event.preventDefault();
      setIsDiagnosticsOpen((current) => {
        const next = !current;
        if (typeof window !== 'undefined') {
          if (next) {
            window.localStorage.setItem(SCANNER_DIAG_KEY, '1');
          } else {
            window.localStorage.removeItem(SCANNER_DIAG_KEY);
          }
        }
        return next;
      });
    }

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  useEffect(() => {
    focusScannerInput();
    flushScannerSalesQueue({
      token: currentUser?.sessionToken || ''
    }).catch(() => {});
  }, [currentUser?.sessionToken, focusScannerInput]);

  useEffect(() => {
    if (isManualModalOpen || quickAddState.isOpen) {
      return;
    }
    if (scannerState.scanStatus !== 'loading') {
      focusScannerInput();
    }
  }, [focusScannerInput, isManualModalOpen, quickAddState.isOpen, scannerState.scanStatus]);

  useEffect(() => {
    function handleOnline() {
      syncErrorCountRef.current = 0;
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
    if (pendingSalesCount === 0) {
      syncErrorCountRef.current = 0;
    }
  }, [pendingSalesCount]);

  useEffect(() => {
    unauthorizedHandledRef.current = false;
  }, [currentUser?.sessionToken]);

  useEffect(() => {
    const unsubscribeErrors = subscribeScannerSalesQueueErrors((error) => {
      setQueueDebugSnapshot(getScannerSalesQueueDebugSnapshot());
      const status = Number(error?.status || 0);
      const errorMessage = String(error?.message || '').toLowerCase();
      const isUnauthorized = status === 401 || errorMessage.includes('unauthorized') || errorMessage.includes('sesion expirada');
      if (isUnauthorized) {
        if (unauthorizedHandledRef.current) {
          return;
        }
        unauthorizedHandledRef.current = true;
        toast.warn('Sesion vencida. Inicia sesion nuevamente para sincronizar ventas pendientes.', {
          toastId: 'scanner-session-expired',
          autoClose: 2200
        });
        window.setTimeout(() => {
          onUnauthorized?.();
        }, 900);
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      syncErrorCountRef.current += 1;
      if (syncErrorCountRef.current < 2) {
        return;
      }

      const now = Date.now();
      if (now - lastSyncErrorToastAtRef.current < SALE_SYNC_ERROR_TOAST_COOLDOWN_MS) {
        return;
      }
      lastSyncErrorToastAtRef.current = now;
      toast.error('No se pudo sincronizar una compra en este momento. Se reintentara en segundo plano.', {
        toastId: 'scanner-sale-sync-error',
        autoClose: 3500
      });
    });

    return () => {
      unsubscribeErrors();
    };
  }, [onUnauthorized]);

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
      const manualName = selectedManualProduct?.label || 'Producto Manual';
      updateLiveEditorDraft({
        nombre: manualName,
        precio_venta_raw: String(rawValue || ''),
        precio_venta: Number(String(rawValue || '').replace(',', '.')) || 0
      });
    },
    [selectedManualProduct?.label, updateLiveEditorDraft]
  );

  function closeManualModal() {
    setIsManualModalOpen(false);
    setSelectedManualProduct(null);
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
  const pendingQuickAddItems = scannerState.cartItems.filter((item) => item.isQuickAddPending);
  const failedQuickAddItems = scannerState.cartItems.filter((item) => !item.isQuickAddPending && item.quickAddSyncError);
  const isChargeBlocked = pendingQuickAddItems.length > 0 || failedQuickAddItems.length > 0;
  const chargeBlockMessage = pendingQuickAddItems.length > 0
    ? 'Esperando guardar producto nuevo en backend antes de cobrar.'
    : (failedQuickAddItems.length > 0 ? 'Hay un producto nuevo con error de alta. Revisalo antes de cobrar.' : '');

  return (
    <>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-9">
            {isWorkerDayBannerVisible ? (
              <section className={`scanner-worker-day-banner scanner-worker-day-banner-${workerDayBannerTone} mb-3`} aria-label="Saludo dia del trabajador">
                <div className="scanner-worker-day-banner-copy">
                  <p className="scanner-worker-day-banner-kicker mb-1">
                    <span>Feliz Dia del Trabajador</span>
                    <span className={`scanner-worker-day-banner-kicker-gear scanner-worker-day-banner-kicker-gear-${workerDayBannerGearKey}`} aria-hidden="true">
                      <Cog className="scanner-worker-day-banner-gear scanner-worker-day-banner-gear-main" size={12} />
                      <Cog className="scanner-worker-day-banner-gear scanner-worker-day-banner-gear-secondary" size={9} />
                      <Cog className="scanner-worker-day-banner-gear scanner-worker-day-banner-gear-tertiary" size={8} />
                    </span>
                  </p>
                  <p className="scanner-worker-day-banner-quote mb-0">
                    "{WORKER_DAY_BANNER_COPY.quote}" <span className="scanner-worker-day-banner-author">By {WORKER_DAY_BANNER_COPY.author}</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="scanner-worker-day-banner-close"
                  aria-label="Cerrar saludo"
                  onClick={() => setIsWorkerDayBannerDismissed(true)}
                >
                  <X size={16} />
                </button>
              </section>
            ) : null}

            <ScannerInput
              ref={scannerInputRef}
              barcode={scannerState.scanBarcode}
              scanStatus={scannerState.scanStatus}
              onBarcodeChange={actions.setScanBarcode}
              onSubmit={handleScanSubmit}
            />

            <div className="text-center mt-4">
              <div className="scanner-manual-grid scanner-manual-grid--fuerte" role="group" aria-label="Productos manuales rápidos">
                {MANUAL_PRODUCT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`btn scanner-manual-btn ${option.key === 'otros' ? 'scanner-manual-btn-centered' : ''}`}
                      onClick={() => {
                        clearScanError();
                        setSelectedManualProduct(option);
                        startManualLiveEditor({
                          title: option.label,
                          manualName: option.label
                        });
                        setIsManualModalOpen(true);
                      }}
                    >
                      <Icon size={18} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <ScannerCart
              items={scannerState.cartItems}
              lastScannedItemId={scannerState.lastScannedItemId}
              latestRowTone="gray-b"
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
                isChargeBlocked={isChargeBlocked}
                chargeBlockMessage={chargeBlockMessage}
                onCharge={executeCharge}
                openConfirmSignal={openConfirmSignal}
                confirmByEnterSignal={confirmByEnterSignal}
                onConfirmModalOpenChange={setIsCheckoutConfirmOpen}
              />
            ) : null}

            {isDiagnosticsOpen ? (
              <section className="scanner-diagnostics mt-4" aria-label="Diagnostico scanner">
                <div className="scanner-diagnostics-header">
                  <h2 className="scanner-diagnostics-title mb-0">Diagnostico scanner</h2>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setIsDiagnosticsOpen(false);
                      if (typeof window !== 'undefined') {
                        window.localStorage.removeItem(SCANNER_DIAG_KEY);
                      }
                    }}
                  >
                    Ocultar
                  </button>
                </div>
                <div className="scanner-diagnostics-grid">
                  <div className="scanner-diagnostics-card">
                    <span className="scanner-diagnostics-label">Token</span>
                    <strong>{currentUser?.sessionToken ? 'Activo' : 'Ausente'}</strong>
                  </div>
                  <div className="scanner-diagnostics-card">
                    <span className="scanner-diagnostics-label">Cola pendientes</span>
                    <strong>{queueDebugSnapshot.pending}</strong>
                  </div>
                  <div className="scanner-diagnostics-card">
                    <span className="scanner-diagnostics-label">Quick add pendientes</span>
                    <strong>{pendingQuickAddItems.length}</strong>
                  </div>
                  <div className="scanner-diagnostics-card">
                    <span className="scanner-diagnostics-label">Quick add con error</span>
                    <strong>{failedQuickAddItems.length}</strong>
                  </div>
                </div>
                <div className="scanner-diagnostics-log">
                  <span className="scanner-diagnostics-label">Ultimo error sync</span>
                  <strong>{queueDebugSnapshot.lastError?.message || 'Sin errores registrados'}</strong>
                  {queueDebugSnapshot.lastError?.status ? (
                    <span className="scanner-diagnostics-meta">HTTP {queueDebugSnapshot.lastError.status}</span>
                  ) : null}
                  {queueDebugSnapshot.lastError?.at ? (
                    <span className="scanner-diagnostics-meta">{queueDebugSnapshot.lastError.at}</span>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <ScannerManualModal
        isOpen={isManualModalOpen}
        onClose={closeManualModal}
        onConfirm={(value) => actions.addManualProduct(value, {
          manualName: selectedManualProduct?.label || 'Producto Manual',
          manualCategory: selectedManualProduct?.category || 'manual'
        })}
        onValueChange={handleManualValueChange}
        errorMessage={modalErrorMessage}
        productName={selectedManualProduct?.label || 'Producto manual'}
      />

      <ScannerQuickAddModal
        isOpen={quickAddState.isOpen}
        barcode={quickAddState.barcode}
        onClose={closeQuickAddModal}
        onConfirm={(payload) => actions.addQuickBarcodeProduct(payload, {
          onBackgroundError: ({ error, nombre }) => {
            toast.error(`${nombre || 'Producto Manual'} dio error al guardar en backend.`, {
              toastId: `scanner-quick-add-fail-${Date.now()}`,
              autoClose: 3200
            });
            console.error('[SCANNER][QUICK_ADD][ERROR]', error);
          }
        })}
        onDraftChange={actions.updateLiveEditorDraft}
        errorMessage={quickAddErrorMessage}
      />
    </>
  );
}

export default ScannerFeature;

