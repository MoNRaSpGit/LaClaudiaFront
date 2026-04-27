import { money, renderLiveEditorPrice } from '../model/panelControl.formatters';

function LiveCartPanel({
  operatorName,
  liveEditor,
  hasLiveItems,
  liveTimeLabel,
  liveTotal,
  liveItems
}) {
  return (
    <article className="panel-block-v2 panel-large-block panel-block-accent-green">
      <div className="panel-block-header panel-block-title-cell">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h3 className="h6 mb-0">Caja en vivo</h3>
          <span className="badge text-bg-success">En vivo</span>
        </div>
        <p className="panel-help mb-0">Espejo en tiempo real de lo que arma el operario en el scanner.</p>
        {liveEditor ? (
          <div className="panel-live-alert">
            <p className="panel-live-alert-title mb-1">{liveEditor.title}</p>
            {liveEditor.draft ? (
              <div className="panel-live-alert-preview">
                <span>{liveEditor.draft.nombre === '' ? '(vacío)' : (liveEditor.draft.nombre || 'Producto sin nombre')}</span>
                <strong>{renderLiveEditorPrice(liveEditor.draft)}</strong>
              </div>
            ) : null}
          </div>
        ) : null}
        {hasLiveItems ? (
          <div className="panel-live-banner">
            <div>
              <p className="panel-live-banner-title mb-0">{operatorName}</p>
              <p className="panel-live-banner-subtitle mb-0">{liveTimeLabel}</p>
            </div>
            <div className="text-end">
              <p className="panel-live-banner-subtitle mb-0">Total actual</p>
              <p className="panel-live-banner-total mb-0">{money(liveTotal)}</p>
            </div>
          </div>
        ) : null}
      </div>
      <div className="panel-block-content panel-block-data-cell">
        {hasLiveItems ? (
          <ul className="panel-live-list mb-0">
            {liveItems.map((item) => (
              <li key={item.id}>
                <div>
                  <span>{item.nombre}</span>
                  <small>x{item.quantity}</small>
                </div>
                <strong>{money(item.precio * item.quantity)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel-empty-state">
            <p className="panel-empty-title mb-1">Sin productos escaneados todavía</p>
            <p className="panel-empty-text mb-0">Cuando el operario agregue o quite productos, la caja se va a clonar acá al instante.</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default LiveCartPanel;
