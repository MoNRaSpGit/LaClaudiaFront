function ScannerCart({ items }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="p-3 p-md-4 rounded-3 border bg-white mt-4">
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-end">Precio</th>
              <th className="text-end">Cant.</th>
              <th className="text-end">Subtotal</th>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ScannerCart;
