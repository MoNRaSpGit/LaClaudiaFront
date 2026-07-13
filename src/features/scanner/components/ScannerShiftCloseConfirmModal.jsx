function ScannerShiftCloseConfirmModal({ isOpen, shiftLabel, onClose, onConfirm }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label={`Cerrar turno ${shiftLabel || ''}`}>
      <div className="scanner-modal-card scanner-shift-close-modal-card">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h2 className="h5 mb-1">Cerrar turno {shiftLabel || ''}</h2>
            <p className="mb-0 small text-muted">
              ¿Seguro que queres cerrar este turno? Si lo cierras, no vas a poder seguir vendiendo en este turno.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary w-50" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-dark w-50" onClick={onConfirm}>
            Cerrar turno
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScannerShiftCloseConfirmModal;
