import { useEffect, useState } from 'react';

function ScannerManualModal({ isOpen, onClose, onConfirm, onValueChange, errorMessage }) {
  const [value, setValue] = useState('');

  function handleConfirm() {
    const ok = onConfirm(value);
    if (ok) {
      setValue('');
      onClose();
    }
  }

  useEffect(() => {
    if (isOpen) {
      setValue('');
      if (onValueChange) {
        onValueChange('');
      }
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Producto manual">
      <div className="scanner-modal-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Producto manual</h2>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          <div className="mb-3">
            <label className="form-label">Ingresa un valor</label>
            <input
              className="form-control"
              value={value}
              onChange={(event) => {
                const nextValue = event.target.value;
                setValue(nextValue);
                if (onValueChange) {
                  onValueChange(nextValue);
                }
              }}
              placeholder="Ej: 150"
              autoFocus
            />
          </div>
          {errorMessage ? <p className="mb-3 scanner-inline-error">{errorMessage}</p> : null}

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary w-50" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-dark w-50">
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScannerManualModal;
