import { moneyNoDecimals } from '../../panelControl/model/panelControl.formatters';
import PanelModal from '../../panelControl/components/PanelModal';

function ProductsSearchPanel({
  searchTerm,
  onChangeSearchTerm,
  items,
  isLoading,
  error,
  hasSearched,
  selectedProductId,
  onSelectProduct,
  onCloseEditor,
  editDraft,
  onChangeDraftField,
  onSave,
  editError,
  isSaving
}) {
  return (
    <section className="panel-section products-search-panel">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-3">
        <div>
          <h2 className="h5 mb-1">Buscador de productos</h2>
          <p className="panel-hero-subtitle mb-0">Escribi el nombre del producto, seleccionalo y edita solo nombre o precio.</p>
        </div>
        <div className="products-search-input-wrap">
          <label className="form-label fw-semibold mb-1" htmlFor="products-search-input">Producto</label>
          <input
            id="products-search-input"
            type="search"
            className="form-control products-search-input"
            placeholder="Ej: mayonesa, arroz, coca"
            value={searchTerm}
            onChange={(event) => onChangeSearchTerm(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {error ? <p className="app-inline-error mb-3">{error}</p> : null}
      {!hasSearched ? <p className="text-secondary mb-0">Escribi al menos 2 letras para buscar.</p> : null}
      {hasSearched && isLoading ? <p className="text-secondary mb-0">Buscando productos...</p> : null}
      {hasSearched && !isLoading && !error && items.length === 0 ? (
        <p className="text-secondary mb-0">No encontramos productos con ese nombre.</p>
      ) : null}

      {items.length > 0 ? (
        <div className="table-responsive">
          <table className="table align-middle mb-0 products-search-table">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col" className="text-end">Precio</th>
                <th scope="col" className="text-end">Accion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelected = Number(item.id) === Number(selectedProductId);
                return (
                  <tr key={item.id} className={isSelected ? 'products-search-row-selected' : ''}>
                    <td className="fw-semibold">{item.nombre || 'Sin nombre'}</td>
                    <td className="text-end fw-bold">{moneyNoDecimals(item.precio_venta)}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-dark' : 'btn-outline-dark'}`}
                        onClick={() => onSelectProduct(item)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedProductId ? (
        <PanelModal
          title="Editar producto"
          onClose={onCloseEditor}
          body={(
            <form onSubmit={onSave} className="d-grid gap-3">
              <div>
                <label className="form-label fw-semibold mb-1" htmlFor="products-edit-name">Nombre</label>
                <input
                  id="products-edit-name"
                  type="text"
                  className="form-control"
                  value={editDraft.nombre}
                  onChange={(event) => onChangeDraftField('nombre', event.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="form-label fw-semibold mb-1" htmlFor="products-edit-price">Precio</label>
                <input
                  id="products-edit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={editDraft.precio_venta}
                  onChange={(event) => onChangeDraftField('precio_venta', event.target.value)}
                  disabled={isSaving}
                />
              </div>
              {editError ? <p className="app-inline-error mb-0">{editError}</p> : null}
              <div className="d-grid gap-2">
                <button type="submit" className="btn btn-dark" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={onCloseEditor} disabled={isSaving}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        />
      ) : null}
    </section>
  );
}

export default ProductsSearchPanel;
