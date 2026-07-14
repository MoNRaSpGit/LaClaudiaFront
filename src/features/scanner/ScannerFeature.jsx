import { useCallback, useEffect, useRef, useState } from 'react';
import { Apple, Beef, ChevronDown, CircleEllipsis, Cog, Scale, Wheat, X } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import { useScannerController } from './model/useScannerController';
import ScannerInput from './components/ScannerInput';
import ScannerCart from './components/ScannerCart';
import ScannerCheckout from './components/ScannerCheckout';
import ScannerManualModal from './components/ScannerManualModal';
import ScannerQuickAddModal from './components/ScannerQuickAddModal';
import ScannerShiftCloseConfirmModal from './components/ScannerShiftCloseConfirmModal';
import ScannerShiftOpeningCashModal from './components/ScannerShiftOpeningCashModal';
import { fetchScannerCustomers, publishScannerLiveState } from './services/scanner.api';
import {
  classifyDiagnosticError,
  flushScannerDiagnosticQueue,
  reportScannerDiagnosticEvent
} from './services/scanner.diagnostics';
import { printSaleTicket } from './services/scanner.print';
import { printSaleTicketByQz } from './services/scanner.qzPrint';
import { closeScannerShift, openScannerShift } from './services/scanner.shifts.api';
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
const DIAGNOSTIC_FLUSH_RETRY_MS = 10000;
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

function isRouteUnavailableError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').trim().toLowerCase();
  return status === 404 || message.includes('route not found') || message.includes('not found');
}

function ScannerFeature({ currentUser, onUnauthorized }) {
  const {
    scannerState,
    totals,
    actions,
    shiftState,
    isShiftOpen,
    isShiftLoading,
    refreshShiftState
  } = useScannerController({ currentUser });
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
  const [isOpeningShiftCashModalOpen, setIsOpeningShiftCashModalOpen] = useState(false);
  const [openingShiftTarget, setOpeningShiftTarget] = useState('');
  const [pendingSalesCount, setPendingSalesCount] = useState(getScannerSalesQueuePendingCount());
  const [customerOptions, setCustomerOptions] = useState([]);
  const [isCustomerAccountsAvailable, setIsCustomerAccountsAvailable] = useState(true);
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
  const [isShiftDetailsExpanded, setIsShiftDetailsExpanded] = useState(false);
  const [isShiftCloseConfirmOpen, setIsShiftCloseConfirmOpen] = useState(false);
  const scannerInputRef = useRef(null);
  const lastSyncErrorToastAtRef = useRef(0);
  const syncErrorCountRef = useRef(0);
  const unauthorizedHandledRef = useRef(false);
  const lastChargeAtRef = useRef(0);
  const lastLiveStateSignatureRef = useRef('');
  const isWorkerDayBannerVisible = currentStoreDateLabel === WORKER_DAY_BANNER_DATE && !isWorkerDayBannerDismissed;
  const isScannerLocked = !isShiftOpen;
  const shiftLockMessage = isShiftLoading ? 'Verificando turno...' : 'Abrir turno';
  const activeShiftLabel = shiftState.activeShift?.shiftLabel || '';
  const activeShiftSales = Number(shiftState.activeShift?.salesTotal || 0);
  const activeShiftCount = Number(shiftState.activeShift?.salesCount || 0);
  const activeShiftOpeningCash = Number(shiftState.activeShift?.shiftOpeningCash ?? shiftState.activeShift?.openingCash ?? 0);
  const activeShiftCashSales = Number(shiftState.activeShift?.cashSalesTotal || 0);
  const activeShiftCashTotal = Number(shiftState.activeShift?.cashTotal || 0);
  const activeShiftPaymentSummary = shiftState.activeShift?.paymentSummary || { efectivo: 0, tarjeta: 0, credito: 0 };
  const currentUserId = Number(currentUser?.id || 0);
  const canCloseActiveShift = Boolean(isShiftOpen) && currentUserId > 0;
  const shiftTypeLabels = {
    manana: 'Mañana',
    tarde: 'Tarde',
    noche: 'Noche'
  };

  async function handleOpenShift(shiftType) {
    const normalizedShiftType = String(shiftType || '').trim().toLowerCase();
    if (!normalizedShiftType) {
      return;
    }
    setOpeningShiftTarget(normalizedShiftType);
    setIsOpeningShiftCashModalOpen(true);
  }

  async function confirmOpenShift(openingCash) {
    if (!openingShiftTarget) {
      return false;
    }

    const normalizedShiftType = String(openingShiftTarget || '').trim().toLowerCase();
    const shiftLabel = shiftTypeLabels[normalizedShiftType] || normalizedShiftType;

    try {
      await openScannerShift(normalizedShiftType, {
        token: currentUser?.sessionToken || '',
        date: currentStoreDateLabel,
        openingCash
      });
      refreshShiftState({ silent: true }).catch(() => {});
      toast.success(`Turno ${shiftLabel} abierto.`, {
        toastId: `scanner-open-shift-${normalizedShiftType}`,
        autoClose: 1800
      });
      setIsOpeningShiftCashModalOpen(false);
      setOpeningShiftTarget('');
      return true;
    } catch (error) {
      toast.error(error?.message || 'No se pudo abrir el turno.', {
        toastId: `scanner-open-shift-error-${normalizedShiftType}`,
        autoClose: 2200
      });
      return false;
    }
  }

  async function handleCloseShift() {
    if (!shiftState.activeShift?.id || !canCloseActiveShift) {
      return;
    }

    try {
      await closeScannerShift(shiftState.activeShift.id, {
        token: currentUser?.sessionToken || ''
      });
      await refreshShiftState({ silent: true });
      toast.success('Turno cerrado.', {
        toastId: `scanner-close-shift-${shiftState.activeShift.id}`,
        autoClose: 1800
      });
    } catch (error) {
      toast.error(error?.message || 'No se pudo cerrar el turno.', {
        toastId: `scanner-close-shift-error-${shiftState.activeShift.id}`,
        autoClose: 2200
      });
    }
  }

  function openCloseShiftConfirm() {
    if (!shiftState.activeShift?.id || !canCloseActiveShift) {
      return;
    }
    setIsShiftCloseConfirmOpen(true);
  }

  useEffect(() => {
    if (!isShiftOpen) {
      setIsShiftDetailsExpanded(false);
    }
  }, [isShiftOpen]);

  useEffect(() => {
    if (isShiftOpen) {
      setIsOpeningShiftCashModalOpen(false);
      setOpeningShiftTarget('');
    }
  }, [isShiftOpen]);

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
    flushScannerDiagnosticQueue({
      token: currentUser?.sessionToken || ''
    }).catch(() => {});
  }, [currentUser?.sessionToken, focusScannerInput]);

  useEffect(() => {
    const token = String(currentUser?.sessionToken || '').trim();
    if (!token) {
      setCustomerOptions([]);
      setIsCustomerAccountsAvailable(true);
      return;
    }

    fetchScannerCustomers({ token })
      .then((data) => {
        setIsCustomerAccountsAvailable(true);
        setCustomerOptions(Array.isArray(data?.customers) ? data.customers : []);
      })
      .catch((error) => {
        if (isRouteUnavailableError(error)) {
          setIsCustomerAccountsAvailable(false);
        }
        setCustomerOptions([]);
      });
  }, [currentUser?.sessionToken]);

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
      flushScannerDiagnosticQueue({
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
    const token = String(currentUser?.sessionToken || '').trim();
    if (!token) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      flushScannerDiagnosticQueue({ token }).catch(() => {});
    }, DIAGNOSTIC_FLUSH_RETRY_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser?.sessionToken]);

  useEffect(() => {
    unauthorizedHandledRef.current = false;
  }, [currentUser?.sessionToken]);

  useEffect(() => {
    const unsubscribeErrors = subscribeScannerSalesQueueErrors((error) => {
      setQueueDebugSnapshot(getScannerSalesQueueDebugSnapshot());
      const status = Number(error?.status || 0);
      const errorMessage = String(error?.message || '').toLowerCase();
      const isUnauthorized = status === 401 || errorMessage.includes('unauthorized') || errorMessage.includes('sesion expirada');
      reportScannerDiagnosticEvent({
        eventType: isUnauthorized ? 'scanner.session_unauthorized' : 'scanner.sale_sync_error',
        severity: isUnauthorized ? 'warning' : 'error',
        message: String(error?.message || '').trim() || 'Error de sincronizacion en scanner',
        error,
        context: {
          status,
          statusText: String(error?.statusText || '').trim(),
          endpoint: String(error?.endpoint || '').trim() || '/api/scanner/sales',
          method: String(error?.method || '').trim() || 'POST',
          flow: String(error?.flow || '').trim() || 'scanner_sale_sync',
          trigger: String(error?.trigger || '').trim() || 'queue_retry',
          errorFamily: String(error?.errorFamily || '').trim() || classifyDiagnosticError(error),
          pending: getScannerSalesQueuePendingCount(),
          online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true
        }
      }, {
        token: currentUser?.sessionToken || '',
        currentUser
      }).catch(() => {});
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
  }, [currentUser, onUnauthorized]);

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

  const executeCharge = useCallback(async (chargeOptions) => {
    const result = await actions.chargeCart(chargeOptions);
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
              isShiftOpen={isShiftOpen}
              isShiftLoading={isShiftLoading}
              shiftLockMessage={shiftLockMessage}
            />

            <div className={`scanner-shift-banner mt-3 ${isScannerLocked ? 'scanner-shift-banner-locked' : 'scanner-shift-banner-open'} ${isShiftOpen && !isShiftDetailsExpanded ? 'scanner-shift-banner-open-compact' : ''}`}>
              <div className="scanner-shift-banner-main">
                <div className="scanner-shift-banner-copy">
                  {isShiftLoading ? (
                    <p className="scanner-shift-banner-title mb-0">Cargando estado...</p>
                  ) : isShiftOpen ? (
                    <>
                      <div className="scanner-shift-banner-open-head">
                        <p className="scanner-shift-banner-title mb-0">Turno {activeShiftLabel}</p>
                        <div className="d-flex align-items-center gap-2">
                          {canCloseActiveShift ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark scanner-shift-close-btn"
                              onClick={openCloseShiftConfirm}
                            >
                              Cerrar turno
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`scanner-shift-banner-toggle ${isShiftDetailsExpanded ? 'scanner-shift-banner-toggle-open' : ''}`}
                            aria-label={isShiftDetailsExpanded ? 'Contraer turno' : 'Expandir turno'}
                            onClick={() => setIsShiftDetailsExpanded((current) => !current)}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </div>
                      {isShiftDetailsExpanded ? (
                        <>
                          <p className="scanner-shift-banner-subtitle mb-0">
                            Caja apertura turno: ${activeShiftOpeningCash.toFixed(2)} | Efectivo: ${activeShiftCashSales.toFixed(2)} | Caja total: ${activeShiftCashTotal.toFixed(2)}
                          </p>
                          <p className="scanner-shift-banner-subtitle mb-0">
                            Ventas: ${activeShiftSales.toFixed(2)} | Tickets: {activeShiftCount}
                          </p>
                          <div className="scanner-shift-payment-summary mt-2">
                            <span>Efectivo {Number(activeShiftPaymentSummary.efectivo || 0).toFixed(2)}</span>
                            <span>Tarjeta {Number(activeShiftPaymentSummary.tarjeta || 0).toFixed(2)}</span>
                            <span>Crédito {Number(activeShiftPaymentSummary.credito || 0).toFixed(2)}</span>
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="scanner-shift-banner-title scanner-shift-banner-title-danger mb-0">Abrir turno</p>
                      <p className="scanner-shift-banner-subtitle mb-0">No se puede vender hasta que se abra un turno.</p>
                      <div className="scanner-shift-banner-actions mt-3">
                      {['manana', 'tarde', 'noche'].map((shiftType) => {
                        const shift = shiftState.shifts.find((item) => item.shiftType === shiftType);
                        const isOpen = Boolean(shift?.isOpen);
                        return (
                          <button
                            key={shiftType}
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={isShiftLoading || isOpen}
                            onClick={() => {
                              handleOpenShift(shiftType);
                            }}
                          >
                            {isOpen ? `${shiftTypeLabels[shiftType]} abierto` : `Abrir ${shiftTypeLabels[shiftType]}`}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                  <div className="scanner-shift-banner-actions mt-3">
                    <span className="small text-muted">
                      Cualquiera con sesion activa puede cerrar el turno.
                    </span>
                  </div>
                </div>
                {isShiftOpen && isShiftDetailsExpanded ? (
                  <div className="scanner-shift-banner-badges">
                    {shiftState.shifts.map((shift) => (
                      <span
                        key={shift.shiftType}
                        className={`scanner-shift-pill ${shift.isOpen ? 'scanner-shift-pill-open' : ''}`}
                      >
                        {shift.shiftLabel}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <ScannerShiftOpeningCashModal
              isOpen={isOpeningShiftCashModalOpen}
              shiftLabel={shiftTypeLabels[openingShiftTarget] || openingShiftTarget}
              onClose={() => {
                setIsOpeningShiftCashModalOpen(false);
                setOpeningShiftTarget('');
              }}
              onConfirm={confirmOpenShift}
            />
            <ScannerShiftCloseConfirmModal
              isOpen={isShiftCloseConfirmOpen}
              shiftLabel={activeShiftLabel}
              onClose={() => setIsShiftCloseConfirmOpen(false)}
              onConfirm={async () => {
                setIsShiftCloseConfirmOpen(false);
                await handleCloseShift();
              }}
            />

            <div className="text-center mt-4">
              <div className="scanner-manual-grid scanner-manual-grid--fuerte" role="group" aria-label="Productos manuales rápidos">
                {MANUAL_PRODUCT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isDisabled = isScannerLocked;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`btn scanner-manual-btn ${option.key === 'otros' ? 'scanner-manual-btn-centered' : ''}`}
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) {
                          toast.error('Abrir turno', {
                            toastId: 'scanner-shift-closed-manual',
                            autoClose: 1800
                          });
                          return;
                        }
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
                isChargeBlocked={isChargeBlocked || isScannerLocked}
                chargeBlockMessage={!isShiftOpen ? 'Abrir turno' : chargeBlockMessage}
                customerOptions={customerOptions}
                isCustomerAccountsAvailable={isCustomerAccountsAvailable}
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
            reportScannerDiagnosticEvent({
              eventType: 'scanner.quick_add_sync_error',
              severity: 'error',
              message: String(error?.message || '').trim() || 'Error en alta rapida de producto',
              error,
              context: {
                productName: nombre || 'Producto Manual',
                status: Number(error?.status || 0),
                statusText: String(error?.statusText || '').trim(),
                endpoint: '/api/scanner/products',
                method: 'POST',
                flow: 'scanner_quick_add',
                trigger: 'quick_add_confirm',
                errorFamily: classifyDiagnosticError(error)
              }
            }, {
              token: currentUser?.sessionToken || '',
              currentUser
            }).catch(() => {});
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

