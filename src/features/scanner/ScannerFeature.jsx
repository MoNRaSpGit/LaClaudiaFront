import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import QRCode from 'qrcode';
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
const LAB_CUSTOMER = {
  id: 'juan-01',
  name: 'Juan',
  qrCode: 'QR-JUAN-APP'
};

function normalizeLabCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function ScannerFeature({ currentUser }) {
  const { scannerState, totals, actions } = useScannerController({ currentUser });
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
  const [labPaymentCode, setLabPaymentCode] = useState('');
  const [labPaymentQrDataUrl, setLabPaymentQrDataUrl] = useState('');
  const [labStatement, setLabStatement] = useState({
    customerName: LAB_CUSTOMER.name,
    lastMovementAt: '',
    total: 0,
    items: []
  });
  const [labCardConfirm, setLabCardConfirm] = useState({
    isOpen: false,
    customerName: '',
    total: 0,
    itemsCount: 0,
    code: '',
    items: []
  });
  const scannerInputRef = useRef(null);
  const lastSyncErrorToastAtRef = useRef(0);

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
    if (!labPaymentCode) {
      setLabPaymentQrDataUrl('');
      return;
    }
    QRCode.toDataURL(labPaymentCode, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 170,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
      .then((url) => {
        setLabPaymentQrDataUrl(url);
      })
      .catch(() => {
        setLabPaymentQrDataUrl('');
      });
  }, [labPaymentCode]);

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
    isOperario,
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
    actions.clearScanError();
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

  function openLabCardConfirm({ code }) {
    const itemsCount = scannerState.cartItems.reduce((acc, item) => acc + Number(item.quantity || 1), 0);
    const total = Number(totals.total || 0);
    const items = scannerState.cartItems.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      quantity: Number(item.quantity || 1),
      precio: Number(item.precio_venta || 0),
      subtotal: Number(item.quantity || 1) * Number(item.precio_venta || 0)
    }));
    setLabCardConfirm({
      isOpen: true,
      customerName: LAB_CUSTOMER.name,
      total,
      itemsCount,
      code,
      items
    });
  }

  const executeCharge = useCallback(async () => {
    const result = await actions.chargeCart();
    if (result?.ok) {
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
    if (labPaymentCode && normalizeLabCode(normalizedBarcode) === normalizeLabCode(labPaymentCode)) {
      actions.setScanBarcode('');
      if (!scannerState.cartItems.length) {
        toast.info('No hay productos en carrito para pago móvil.', {
          toastId: `scanner-lab-mobile-empty-${Date.now()}`,
          autoClose: 1800
        });
        return;
      }
      openLabCardConfirm({ code: normalizedBarcode });
      return;
    }

    if (!normalizedBarcode && scannerState.cartItems.length > 0) {
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
    actions.startQuickBarcodeLiveEditor({
      barcode
    });
    setQuickAddState({
      isOpen: true,
      barcode
    });
  }

  const modalErrorMessage = isManualModalOpen ? scannerState.scanError : '';

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
                  actions.clearScanError();
                  actions.startManualLiveEditor();
                  setIsManualModalOpen(true);
                }}
              >
                Producto manual
              </button>
            </div>

            <section className="scanner-checkout mt-3">
              <p className="mb-2 fw-semibold">Laboratorio pago móvil (cliente app)</p>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark"
                  onClick={() => {
                    const code = LAB_CUSTOMER.qrCode;
                    setLabPaymentCode(code);
                    toast.success(`Código generado para ${LAB_CUSTOMER.name}`, {
                      toastId: `scanner-lab-mobile-generate-${Date.now()}`,
                      autoClose: 1600
                    });
                    focusScannerInput();
                  }}
                >
                  Generar código
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={!labPaymentCode}
                  onClick={() => {
                    if (!labPaymentCode) {
                      return;
                    }
                    actions.setScanBarcode(labPaymentCode);
                    handleScanSubmit().catch(() => {});
                  }}
                >
                  Simular escaneo código
                </button>
              </div>
              {labPaymentCode ? (
                <div className="mt-3 p-2 border rounded bg-white d-flex flex-column align-items-center">
                  <p className="mb-1 text-muted">QR de pago (cliente app)</p>
                  {labPaymentQrDataUrl ? (
                    <>
                      <img src={labPaymentQrDataUrl} alt="QR laboratorio pago móvil" width={170} height={170} />
                    </>
                  ) : null}
                  <p className="mt-1 mb-0"><strong>{labPaymentCode}</strong></p>
                </div>
              ) : null}
              <p className="mb-1 mt-2 text-muted">
                Código actual: <strong>{labPaymentCode || '—'}</strong>
              </p>
              <div className="mt-2 p-2 border rounded bg-white">
                <p className="mb-2 fw-semibold">Estado de cuenta (simulado)</p>
                {labStatement.items.length ? (
                  <>
                    <p className="mb-1 text-muted">
                      Cliente: <strong>{labStatement.customerName}</strong> | Total: <strong>${Number(labStatement.total || 0).toFixed(2)}</strong>
                    </p>
                    <p className="mb-2 text-muted">Fecha: {labStatement.lastMovementAt}</p>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>Cant.</th>
                            <th>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labStatement.items.map((item) => (
                            <tr key={String(item.id)}>
                              <td>{item.nombre}</td>
                              <td>{item.quantity}</td>
                              <td>${Number(item.subtotal || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="mb-0 text-muted">Sin compras registradas aún.</p>
                )}
              </div>
            </section>

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
      />

      {labCardConfirm.isOpen ? (
        <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirmar pago móvil">
          <div className="scanner-modal-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Confirmar pago móvil</h2>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setLabCardConfirm({ isOpen: false, customerName: '', total: 0, itemsCount: 0, code: '', items: [] });
                  focusScannerInput();
                }}
              >
                X
              </button>
            </div>
            <p className="mb-1">Usuario: <strong>{labCardConfirm.customerName}</strong></p>
            <p className="mb-1">Productos: <strong>{labCardConfirm.itemsCount}</strong></p>
            <p className="mb-3">Total: <strong>${Number(labCardConfirm.total || 0).toFixed(2)}</strong></p>
            <p className="mb-3 text-muted">Código: {labCardConfirm.code}</p>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary w-50"
                onClick={() => {
                  setLabCardConfirm({ isOpen: false, customerName: '', total: 0, itemsCount: 0, code: '', items: [] });
                  toast.info('Pago móvil cancelado.', {
                    toastId: `scanner-lab-mobile-cancel-${Date.now()}`,
                    autoClose: 1600
                  });
                  focusScannerInput();
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-dark w-50"
                onClick={() => {
                  actions.clearCartNow();
                  const at = new Intl.DateTimeFormat('es-UY', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  }).format(new Date());
                  setLabStatement({
                    customerName: labCardConfirm.customerName,
                    lastMovementAt: at,
                    total: Number(labCardConfirm.total || 0),
                    items: Array.isArray(labCardConfirm.items) ? labCardConfirm.items : []
                  });
                  setLabCardConfirm({ isOpen: false, customerName: '', total: 0, itemsCount: 0, code: '', items: [] });
                  toast.success(`Compra confirmada. Estado de cuenta enviado a ${LAB_CUSTOMER.name}.`, {
                    toastId: `scanner-lab-mobile-ok-${Date.now()}`,
                    autoClose: 1900
                  });
                  focusScannerInput();
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default ScannerFeature;
