function ScannerPreview({ status, error, products, onReload }) {
  return (
    <div className="p-3 p-md-4 rounded-3 border bg-white">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <p className="mb-0 fw-semibold">Vista previa de productos (BDD 2)</p>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={onReload}>
          Recargar
        </button>
      </div>

      {status === 'loading' ? <p className="mb-0 text-muted">Cargando...</p> : null}
      {error ? <p className="mb-0 text-danger">{error}</p> : null}

      {products.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Categoria</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td>{product.nombre}</td>
                  <td>{product.categoria || '-'}</td>
                  <td>${Number(product.precio_venta || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default ScannerPreview;
