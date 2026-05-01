import { useEffect, useRef, useState } from 'react';

function ScannerQuickAddModal({
  isOpen,
  barcode,
  onClose,
  onConfirm,
  onDraftChange,
  errorMessage = ''
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const priceInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName('');
    setValue('');
    onDraftChange?.({
      nombre: 'Producto Manual',
      precio_venta_raw: '',
      precio_venta: 0,
      barcode: String(barcode || '')
    });
  }, [barcode, isOpen, onDraftChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = setTimeout(() => {
      priceInputRef.current?.focus();
      priceInputRef.current?.select?.();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isOpen, barcode]);

  if (!isOpen) {
    return null;
  }

  async function handleConfirm() {
    const ok = await onConfirm({
      barcode,
      rawName: name,
      rawValue: value
    });
    if (ok) {
      onClose();
    }
  }

  return (
    <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Producto no encontrado">
      <div className="scanner-modal-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Producto no encontrado</h2>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          <div className="mb-3">
            <label className="form-label">Nombre</label>
            <input
              className="form-control"
              value={name}
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                onDraftChange?.({
                  nombre: String(nextName || '').trim() || 'Producto Manual'
                });
              }}
              placeholder="Opcional"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Precio</label>
            <input
              ref={priceInputRef}
              className="form-control"
              value={value}
              onChange={(event) => {
                const next = event.target.value;
                setValue(next);
                onDraftChange?.({
                  precio_venta_raw: next,
                  precio_venta: Number(String(next || '').replace(',', '.')) || 0
                });
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

export default ScannerQuickAddModal;
