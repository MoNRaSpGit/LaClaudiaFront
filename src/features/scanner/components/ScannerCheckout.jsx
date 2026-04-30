import { useCallback, useEffect, useRef, useState } from 'react';
const ENTER_CONFIRM_GUARD_MS = 350;

function ScannerCheckout({
  total,
  pendingSalesCount = 0,
  onCharge,
  openConfirmSignal = 0,
  confirmByEnterSignal = 0,
  onConfirmModalOpenChange
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpenedAt, setConfirmOpenedAt] = useState(0);
  const lastHandledOpenSignalRef = useRef(0);
  const lastHandledConfirmSignalRef = useRef(0);

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    const ok = await onCharge();
    setIsSubmitting(false);
    if (ok) {
      setIsConfirmOpen(false);
    }
  }, [isSubmitting, onCharge]);

  useEffect(() => {
    if (openConfirmSignal <= 0) {
      return;
    }
    if (openConfirmSignal === lastHandledOpenSignalRef.current) {
      return;
    }
    lastHandledOpenSignalRef.current = openConfirmSignal;
    setConfirmOpenedAt(Date.now());
    setIsConfirmOpen(true);
  }, [openConfirmSignal]);

  useEffect(() => {
    if (confirmByEnterSignal <= 0) {
      return;
    }
    if (confirmByEnterSignal === lastHandledConfirmSignalRef.current) {
      return;
    }
    lastHandledConfirmSignalRef.current = confirmByEnterSignal;
    if (!isConfirmOpen) {
      return;
    }
    if (Date.now() - confirmOpenedAt < ENTER_CONFIRM_GUARD_MS) {
      return;
    }
    handleConfirm();
  }, [confirmByEnterSignal, handleConfirm, isConfirmOpen, confirmOpenedAt]);

  useEffect(() => {
    onConfirmModalOpenChange?.(isConfirmOpen);
  }, [isConfirmOpen, onConfirmModalOpenChange]);

  return (
    <>
      <div className="scanner-checkout mt-4">
        <div className="scanner-total-row mb-3">
          <span className="scanner-total-label">Total</span>
          <span className="scanner-total">${Number(total || 0).toFixed(2)}</span>
        </div>

        {pendingSalesCount > 0 ? (
          <p className="scanner-sync-hint mb-2">
            Pendientes de sincronizar: <strong>{pendingSalesCount}</strong>
          </p>
        ) : (
          <p className="scanner-sync-hint scanner-sync-hint-ok mb-2">Sincronización al día</p>
        )}

        <button
          type="button"
          className="btn scanner-charge-btn w-100"
          onClick={() => {
            setConfirmOpenedAt(Date.now());
            setIsConfirmOpen(true);
          }}
        >
          Cobrar
        </button>
      </div>

      {isConfirmOpen ? (
        <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirmar cobro">
          <div className="scanner-modal-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Confirmar cobro</h2>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
              >
                X
              </button>
            </div>

            <p className="mb-1 text-muted">Total a cobrar</p>
            <p className="h3 mb-4">${Number(total || 0).toFixed(2)}</p>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary w-50"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-dark w-50"
                disabled={isSubmitting}
                onClick={handleConfirm}
              >
                {isSubmitting ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default ScannerCheckout;
