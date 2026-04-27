import { formatDateTime, money } from '../model/panelControl.formatters';

function renderMovementDetail(item) {
  if (!item?.detail) {
    return null;
  }

  if (item.detail.kind === 'sale') {
    return (
      <div className="panel-movement-detail">
        <ul className="panel-movement-detail-list mb-0">
          {item.detail.items.map((product, index) => (
            <li key={`${product.id}-${index}`}>
              <span>{product.name}</span>
              <strong>{money(product.lineTotal)}</strong>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="panel-movement-detail">
      <p className="panel-movement-detail-title mb-1">Descripción</p>
      <p className="mb-0">{item.detail.description}</p>
    </div>
  );
}

function MovementsPanel({
  hasMovementItems,
  visibleMovementItems,
  canExpandMovements,
  movementExpandLabel,
  expandedMovementId,
  onToggleMovementDetail,
  onExpandMovements
}) {
  return (
    <article className="panel-block-v2 panel-large-block panel-block-accent-blue">
      <div className="panel-block-header panel-block-title-cell">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h3 className="h6 mb-0">Movimientos</h3>
          {canExpandMovements ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onExpandMovements}
            >
              {movementExpandLabel}
            </button>
          ) : null}
        </div>
        <p className="panel-help mb-0">Resumen compacto de ventas y pagos confirmados.</p>
      </div>
      <div className="panel-block-content panel-block-data-cell">
        {hasMovementItems ? (
          <div className="panel-movements-list">
            {visibleMovementItems.map((item) => {
              const movementDate = formatDateTime(item.createdAt);
              return (
                <div key={item.id}>
                  <div className={`panel-movement-row ${item.amount >= 0 ? 'panel-movement-row-sale' : 'panel-movement-row-payment'}`}>
                    <div>
                      <p className={`mb-0 panel-movement-type ${item.amount >= 0 ? 'panel-movement-type-sale' : 'panel-movement-type-payment'}`}>{item.type}</p>
                      <p className="mb-0 panel-movement-row-meta">
                        Operario - {movementDate.date} - {movementDate.time}
                      </p>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className={item.amount >= 0 ? 'panel-amount-plus' : 'panel-amount-minus'}>
                        {item.amount >= 0 ? '+' : '-'}{money(Math.abs(item.amount))}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-dark"
                        onClick={() => onToggleMovementDetail(item.id)}
                      >
                        {expandedMovementId === item.id
                          ? 'Ocultar detalle'
                          : 'Ver detalle'}
                      </button>
                    </div>
                  </div>
                  {expandedMovementId === item.id ? renderMovementDetail(item) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel-empty-state">
            <p className="panel-empty-title mb-1">Sin movimientos recientes</p>
            <p className="panel-empty-text mb-0">Cuando haya ventas confirmadas o pagos registrados, van a aparecer acá.</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default MovementsPanel;
