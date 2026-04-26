function ScannerCart({ items, totals, onInc, onDec, onRemove, onClear }) {
  return (
    <div className="p-3 p-md-4 rounded-3 border bg-white mt-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <p className="mb-0 fw-semibold">Ticket (estilo supermercado)</p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={onClear} disabled={items.length === 0}>
          Limpiar ticket
        </button>
      </div>

      {items.length === 0 ? <p className="mb-0 text-muted">Todavia no hay productos escaneados.</p> : null}

      {items.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-end">Precio</th>
                <th className="text-end">Cant.</th>
                <th className="text-end">Subtotal</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const unitPrice = Number(item.precio_venta || 0);
                const subtotal = unitPrice * Number(item.quantity || 1);

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="fw-semibold">{item.nombre}</div>
                      <div className="small text-muted">Cod: {item.barcode || '-'}</div>
                    </td>
                    <td className="text-end">${unitPrice.toFixed(2)}</td>
                    <td className="text-end">{item.quantity}</td>
                    <td className="text-end">${subtotal.toFixed(2)}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button type="button" className="btn btn-outline-secondary" onClick={() => onDec(item.id)}>-</button>
                        <button type="button" className="btn btn-outline-secondary" onClick={() => onInc(item.id)}>+</button>
                        <button type="button" className="btn btn-outline-danger" onClick={() => onRemove(item.id)}>x</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <hr className="my-3" />
      <div className="d-flex justify-content-end gap-4 fw-semibold">
        <span>Items: {totals.items}</span>
        <span>Total: ${Number(totals.total || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}

export default ScannerCart;
