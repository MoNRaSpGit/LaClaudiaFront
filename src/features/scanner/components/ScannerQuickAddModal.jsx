import { useEffect, useState } from 'react';

function ScannerQuickAddModal({
  isOpen,
  barcode,
  onClose,
  onConfirm,
  onDraftChange
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setValue('');
    onDraftChange?.({
      nombre: 'Producto Manual',
      precio_venta_raw: '',
      precio_venta: 0,
      barcode: String(barcode || '')
    });
  }, [barcode, isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleConfirm() {
    const ok = onConfirm({
      barcode,
      rawValue: value
    });
    if (ok) {
      onClose();
    }
  }

  return (
    <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Ingresa un valor">
      <div className="scanner-modal-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Ingresa un valor</h2>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          <div className="mb-3">
            <label className="form-label">Precio</label>
            <input
              className="form-control"
              value={value}
              onChange={(event) => {
                const next = event.target.value;
                setValue(next);
                onDraftChange?.({
                  nombre: 'Producto Manual',
                  precio_venta_raw: next,
                  precio_venta: Number(String(next || '').replace(',', '.')) || 0
                });
              }}
              placeholder="Ej: 150"
              autoFocus
            />
          </div>

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

export default ScannerQuickAddModal;
