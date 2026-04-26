function ProductThumb({ name, thumbnailUrl }) {
  if (thumbnailUrl) {
    return <img src={thumbnailUrl} alt={name} className="scanner-thumb" loading="lazy" />;
  }

  return <div className="scanner-thumb scanner-thumb-placeholder">Sin imagen</div>;
}

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
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const unitPrice = Number(item.precio_venta || 0);

              return (
                <tr key={item.id}>
                  <td>
                    <div className="d-flex align-items-center gap-3">
                      <ProductThumb name={item.nombre} thumbnailUrl={item.thumbnail_url} />
                      <div className="fw-semibold">{item.nombre}</div>
                    </div>
                  </td>
                  <td className="text-end">${unitPrice.toFixed(2)}</td>
                  <td className="text-end">{item.quantity}</td>
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
