import { useEffect, useRef, useState } from 'react';

function ScannerShiftOpeningCashModal({ isOpen, shiftLabel, onClose, onConfirm, errorMessage = '', isSubmitting = false }) {
  const [value, setValue] = useState('0');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setValue('0');
    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleConfirm() {
    const parsed = Number(String(value || '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      return false;
    }

    return onConfirm(Number(parsed.toFixed(2)));
  }

  return (
    <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label={`Caja inicial ${shiftLabel || ''}`}>
      <div className="scanner-modal-card scanner-shift-open-modal-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="h5 mb-0">Abrir turno {shiftLabel || ''}</h2>
            <p className="mb-0 small text-muted">Ingresa la caja inicial que te dejaron.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (isSubmitting) {
              return;
            }
            const ok = await handleConfirm();
            if (ok) {
              onClose();
            }
          }}
        >
          <div className="mb-3">
            <label className="form-label">Caja inicial</label>
            <input
              ref={inputRef}
              className="form-control"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Ej: 1000"
              autoComplete="off"
              disabled={isSubmitting}
            />
          </div>
          {errorMessage ? <p className="mb-3 scanner-inline-error">{errorMessage}</p> : null}

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary w-50" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-dark w-50" disabled={isSubmitting}>
              {isSubmitting ? 'Abriendo...' : 'Abrir turno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScannerShiftOpeningCashModal;
