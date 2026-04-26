import { useMemo, useState } from 'react';

const todayLabel = new Intl.DateTimeFormat('es-UY', {
  weekday: 'long',
  day: '2-digit',
  month: 'long'
}).format(new Date());

const metrics = [
  { title: 'Caja diaria', value: '$1.000', hint: 'Monto inicial cargado por usuario' },
  { title: 'Ventas del dia', value: '$10.000', hint: 'Confirmadas por boton Cobrar' },
  { title: 'Ganancia diaria', value: '$2.000', hint: '20% de ventas del dia' },
  { title: 'Monto actual', value: '$11.000', hint: 'Caja diaria + ventas del dia' },
  { title: 'Pagos realizados', value: '$356', hint: 'Suma de pagos registrados' }
];

const comparison = {
  record: 20000,
  ayer: 15000,
  hoy: 10000
};

const liveItems = [
  'Yogur 1 litro Caldi',
  'Talco pie 200g',
  'Lavandina 1L'
];

const movementItems = [
  {
    type: 'Venta',
    amount: '+$567',
    detailTitle: 'Detalle venta',
    detailText: 'Productos: Yogur 1L Caldi x1, Talco pie x1.'
  },
  {
    type: 'Pago',
    amount: '-$356',
    detailTitle: 'Detalle pago',
    detailText: 'Se pago Conaprole.'
  },
  {
    type: 'Venta',
    amount: '+$890',
    detailTitle: 'Detalle venta',
    detailText: 'Productos: Azucar 1kg x2, Leche entera x1.'
  }
];

const rankingItems = [
  { name: 'Yogur 1 litro Caldi', qty: 34 },
  { name: 'Talco pie 200g', qty: 29 },
  { name: 'Arroz 1kg', qty: 25 },
  { name: 'Azucar 1kg', qty: 21 },
  { name: 'Leche entera 1L', qty: 18 }
];

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-UY')}`;
}

function percent(value) {
  const normalized = Number(value || 0);
  const sign = normalized > 0 ? '+' : '';
  return `${sign}${normalized.toFixed(2)}%`;
}

function MetricCard({ title, value, hint }) {
  return (
    <article className="panel-metric-card-v2">
      <p className="panel-metric-title">{title}</p>
      <p className="panel-metric-value">{value}</p>
      <p className="panel-metric-hint">{hint}</p>
    </article>
  );
}

function PanelModal({ title, body, onClose }) {
  return (
    <div className="panel-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel-modal-card">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="h5 mb-0">{title}</h3>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>
        <div className="panel-modal-body mb-3">{body}</div>
        <button type="button" className="btn btn-dark w-100" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

function PanelControlFeature() {
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [movementDetail, setMovementDetail] = useState(null);

  const comparisonVsYesterday = useMemo(() => {
    if (!comparison.ayer) return 0;
    return ((comparison.hoy - comparison.ayer) / comparison.ayer) * 100;
  }, []);

  const comparisonVsRecord = useMemo(() => {
    if (!comparison.record) return 0;
    return ((comparison.hoy - comparison.record) / comparison.record) * 100;
  }, []);

  const comparisonClass = comparisonVsYesterday >= 0 ? 'panel-comparison-positive' : 'panel-comparison-negative';

  return (
    <>
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-11">
            <section className="panel-hero mb-4">
              <div>
                <p className="panel-hero-kicker mb-1">Control en vivo</p>
                <h1 className="panel-hero-title mb-1">Caja</h1>
                <p className="panel-hero-subtitle mb-0">{todayLabel}  seguimiento fino de caja, scanner y movimientos.</p>
              </div>
              <div className="panel-status-stack">
                <div className="panel-status-open">Abierta</div>
                <div className="panel-status-user">Admin Nuevo</div>
              </div>
            </section>

            <section className="panel-section mb-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <h2 className="h5 mb-0 panel-section-title">Caja diaria</h2>
              </div>

              <div className="panel-grid-6-v2 mb-4">
                {metrics.map((item) => (
                  <MetricCard key={item.title} title={item.title} value={item.value} hint={item.hint} />
                ))}

                <article className="panel-metric-card-v2 panel-comparison-card">
                  <p className="panel-metric-title">Comparacion</p>
                  <p className="panel-comparison-row mb-2">Hoy vs ayer</p>
                  <div className="panel-comparison-values mb-2">
                    <span>Hoy: <strong>{money(comparison.hoy)}</strong></span>
                    <span>Ayer: <strong>{money(comparison.ayer)}</strong></span>
                  </div>
                  <p className={`panel-comparison-value mb-2 ${comparisonClass}`}>{percent(comparisonVsYesterday)}</p>
                  <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setIsComparisonOpen(true)}>
                    Detalles +
                  </button>
                </article>
              </div>

              <div className="panel-layout-grid-v2">
                <div className="panel-left-stack">
                  <article className="panel-block-v2 panel-large-block panel-block-accent-green">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h3 className="h6 mb-0">Caja en vivo</h3>
                      <span className="badge text-bg-success">En vivo</span>
                    </div>
                    <p className="panel-help mb-3">Espejo en tiempo real de lo que arma el operario en el scanner.</p>
                    <ul className="panel-live-list mb-0">
                      {liveItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="panel-block-v2 panel-large-block panel-block-accent-blue">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h3 className="h6 mb-0">Movimientos</h3>
                      <button type="button" className="btn btn-sm btn-outline-secondary">Ver mas</button>
                    </div>
                    <p className="panel-help mb-3">Resumen compacto de ventas y pagos confirmados.</p>
                    <div className="panel-movements-list">
                      {movementItems.map((item, index) => (
                        <div key={`${item.type}-${index}`} className="panel-movement-row">
                          <div>
                            <p className="mb-0 fw-semibold">{item.type}</p>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span className={item.amount.startsWith('+') ? 'panel-amount-plus' : 'panel-amount-minus'}>{item.amount}</span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark"
                              onClick={() => setMovementDetail(item)}
                            >
                              Detalle
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>

                <div className="panel-right-stack">
                  <article className="panel-block-v2 panel-side-block panel-block-accent-violet">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h3 className="h6 mb-0">Ranking</h3>
                      <button type="button" className="btn btn-sm btn-outline-secondary">Ver mas</button>
                    </div>
                    <p className="panel-help mb-3">Top 5 productos por cantidad vendida.</p>
                    <ol className="panel-ranking-list mb-0">
                      {rankingItems.map((item) => (
                        <li key={item.name}>
                          <span>{item.name}</span>
                          <strong>{item.qty}</strong>
                        </li>
                      ))}
                    </ol>
                  </article>

                  <article className="panel-block-v2 panel-side-block panel-block-accent-orange">
                    <h3 className="h6 mb-3">Registrar pago</h3>
                    <p className="panel-help mb-3">Movimientos manuales, en formato liviano.</p>
                    <div className="d-grid gap-2">
                      <input className="form-control" placeholder="Monto" disabled />
                      <input className="form-control" placeholder="Descripcion" disabled />
                      <button type="button" className="btn btn-dark" disabled>Registrar pago</button>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {isComparisonOpen ? (
        <PanelModal
          title="Comparacion detallada"
          body={(
            <div className="d-grid gap-2">
              <div className="panel-detail-row"><span>Maximo (record)</span><strong>{money(comparison.record)}</strong></div>
              <div className="panel-detail-row"><span>Hoy</span><strong>{money(comparison.hoy)}</strong></div>
              <div className="panel-detail-row"><span>Hoy vs record</span><strong className={comparisonVsRecord >= 0 ? 'panel-comparison-positive' : 'panel-comparison-negative'}>{percent(comparisonVsRecord)}</strong></div>
            </div>
          )}
          onClose={() => setIsComparisonOpen(false)}
        />
      ) : null}

      {movementDetail ? (
        <PanelModal
          title={movementDetail.detailTitle}
          body={<p className="mb-0">{movementDetail.detailText}</p>}
          onClose={() => setMovementDetail(null)}
        />
      ) : null}
    </>
  );
}

export default PanelControlFeature;
