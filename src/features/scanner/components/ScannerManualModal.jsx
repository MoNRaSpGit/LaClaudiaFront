import { useState } from 'react';

function ScannerManualModal({ isOpen, onClose, onConfirm }) {
  const [value, setValue] = useState('');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Producto manual">
      <div className="scanner-modal-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Producto Manual</h2>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>

        <div className="mb-3">
          <label className="form-label">Ingresa valor</label>
          <input
            className="form-control"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ej: 150"
            autoFocus
          />
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary w-50" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-dark w-50"
            onClick={() => {
              const ok = onConfirm(value);
              if (ok) {
                setValue('');
                onClose();
              }
            }}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScannerManualModal;
