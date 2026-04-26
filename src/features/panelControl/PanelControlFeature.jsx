const todayLabel = new Intl.DateTimeFormat('es-UY', {
  weekday: 'long',
  day: '2-digit',
  month: 'long'
}).format(new Date());

const metrics = [
  { title: 'Caja diaria', value: '$1.000', hint: 'Monto inicial cargado por usuario' },
  { title: 'Ventas del dia', value: '$0', hint: 'Confirmadas por boton Cobrar' },
  { title: 'Ganancia diaria', value: '$0', hint: '20% de ventas del dia' },
  { title: 'Monto actual', value: '$1.000', hint: 'Caja diaria + ventas del dia' },
  { title: 'Pagos realizados', value: '$0', hint: 'Suma de pagos registrados' },
  { title: 'Comparacion', value: 'Record $20.000', hint: 'Hoy $10.000  |  -50% vs record' }
];

const liveItems = [
  'Yogur 1 litro Caldi',
  'Talco pie 200g',
  'Lavandina 1L'
];

const movementItems = [
  { type: 'Venta', amount: '+$567', action: 'Detalle' },
  { type: 'Pago', amount: '-$356', action: null },
  { type: 'Venta', amount: '+$890', action: 'Detalle' }
];

const rankingItems = [
  { name: 'Yogur 1 litro Caldi', qty: 34 },
  { name: 'Talco pie 200g', qty: 29 },
  { name: 'Arroz 1kg', qty: 25 },
  { name: 'Azucar 1kg', qty: 21 },
  { name: 'Leche entera 1L', qty: 18 }
];

function MetricCard({ title, value, hint }) {
  return (
    <article className="panel-metric-card-v2">
      <p className="panel-metric-title">{title}</p>
      <p className="panel-metric-value">{value}</p>
      <p className="panel-metric-hint">{hint}</p>
    </article>
  );
}

function PanelControlFeature() {
  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-xl-11">
          <section className="panel-hero mb-4">
            <div>
              <p className="panel-hero-kicker mb-1">Control en vivo</p>
              <h1 className="panel-hero-title mb-1">Caja</h1>
              <p className="panel-hero-subtitle mb-0">{todayLabel}  seguimiento fino de caja, scanner y movimientos.</p>
            </div>
            <div className="panel-status-pill">Abierta  Admin Nuevo</div>
          </section>

          <section className="panel-section mb-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <h2 className="h5 mb-0">Caja diaria</h2>
              <button type="button" className="btn btn-sm btn-outline-secondary">Ver semana y mes</button>
            </div>

            <div className="panel-grid-6-v2 mb-4">
              {metrics.map((item) => (
                <MetricCard key={item.title} title={item.title} value={item.value} hint={item.hint} />
              ))}
            </div>

            <div className="panel-layout-grid-v2">
              <div className="panel-left-stack">
                <article className="panel-block-v2 panel-large-block">
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

                <article className="panel-block-v2 panel-large-block">
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
                          {item.action ? <button type="button" className="btn btn-sm btn-outline-dark">{item.action}</button> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <div className="panel-right-stack">
                <article className="panel-block-v2 panel-side-block">
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

                <article className="panel-block-v2 panel-side-block">
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
  );
}

export default PanelControlFeature;
