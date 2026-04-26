import { useEffect, useMemo, useState } from 'react';

function ProductThumb({ name, thumbnailUrl }) {
  if (thumbnailUrl) {
    return (
      <div className="scanner-thumb-frame">
        <img src={thumbnailUrl} alt={name} className="scanner-thumb" loading="lazy" />
      </div>
    );
  }

  return (
    <div className="scanner-thumb-frame scanner-thumb-placeholder">
      <span className="scanner-thumb-placeholder-label">IMG</span>
    </div>
  );
}

function ScannerEditModal({ item, isOpen, onClose, onDraftChange }) {
  const [draftName, setDraftName] = useState(item?.nombre || '');
  const [draftPrice, setDraftPrice] = useState(item?.precio_venta || '');
  const [draftImage, setDraftImage] = useState(item?.thumbnail_url || '');

  useEffect(() => {
    setDraftName(item?.nombre || '');
    setDraftPrice(item?.precio_venta || '');
    setDraftImage(item?.thumbnail_url || '');
  }, [item]);

  useEffect(() => {
    if (!isOpen || !item) {
      return;
    }

    onDraftChange({
      id: item.id,
      nombre: draftName,
      precio_venta_raw: String(draftPrice || ''),
      precio_venta: Number(String(draftPrice || '').replace(',', '.')) || 0,
      thumbnail_url: draftImage
    });
  }, [draftImage, draftName, draftPrice, isOpen, item]);

  if (!isOpen || !item) {
    return null;
  }

  return (
    <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Editar producto">
      <div className="scanner-modal-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Editar producto</h2>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>

        <div className="mb-3">
          <label className="form-label">Nombre</label>
          <input className="form-control" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="form-label">Precio</label>
          <input className="form-control" value={draftPrice} onChange={(e) => setDraftPrice(e.target.value)} />
        </div>

        <div className="mb-4">
          <label className="form-label">Imagen URL</label>
          <input className="form-control" value={draftImage} onChange={(e) => setDraftImage(e.target.value)} />
        </div>

        <button type="button" className="btn btn-dark w-100" onClick={onClose}>Cerrar (visual)</button>
      </div>
    </div>
  );
}

function ScannerCart({
  items,
  lastScannedItemId,
  onRemoveOne,
  onEditStart,
  onEditDraftChange,
  onEditClose
}) {
  const [editingItemId, setEditingItemId] = useState(null);

  const editingItem = useMemo(
    () => items.find((entry) => String(entry.id) === String(editingItemId)) || null,
    [items, editingItemId]
  );

  if (!items.length) {
    return null;
  }

  return (
    <>
      <div className="p-3 p-md-4 rounded-3 border bg-white mt-4 scanner-products-panel">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 scanner-products-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-center">Editar</th>
                <th className="text-end">Cant.</th>
                <th className="text-end">Total</th>
                <th className="text-end"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const unitPrice = Number(item.precio_venta || 0);
                const isLatest = String(item.id) === String(lastScannedItemId);
                const lineTotal = unitPrice * Number(item.quantity || 1);

                return (
                  <tr key={item.id} className={isLatest ? 'scanner-row-latest' : 'scanner-row-default'}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <ProductThumb name={item.nombre} thumbnailUrl={item.thumbnail_url} />
                        <div>
                          <div className="fw-semibold scanner-product-name">{item.nombre}</div>
                          <div className="scanner-price-badge">${unitPrice.toFixed(2)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setEditingItemId(item.id);
                          onEditStart(item);
                        }}
                      >
                        Editar
                      </button>
                    </td>
                    <td className="text-end fw-semibold">{item.quantity}</td>
                    <td className="text-end fw-semibold">${lineTotal.toFixed(2)}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm scanner-remove-btn"
                        onClick={() => onRemoveOne(item.id)}
                        aria-label={`Quitar una unidad de ${item.nombre}`}
                      >
                        x
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ScannerEditModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onDraftChange={onEditDraftChange}
        onClose={() => {
          setEditingItemId(null);
          onEditClose();
        }}
      />
    </>
  );
}

export default ScannerCart;
