function MetricCard({ title }) {
  return (
    <div className="panel-card panel-metric-card">
      <p className="panel-card-label mb-2">{title}</p>
      <div className="panel-placeholder-line" />
    </div>
  );
}

function BlockCard({ title, className = '' }) {
  return (
    <div className={`panel-card ${className}`.trim()}>
      <p className="panel-card-label mb-2">{title}</p>
      <div className="panel-placeholder-area" />
    </div>
  );
}

function PanelControlFeature() {
  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-xl-11">
          <section className="panel-card mb-4">
            <h1 className="h4 mb-0">Control en vivo</h1>
          </section>

          <section className="panel-card mb-3">
            <h2 className="h5 mb-3">Caja diaria</h2>

            <div className="panel-grid-6 mb-3">
              <MetricCard title="Caja diaria" />
              <MetricCard title="Venta del dia" />
              <MetricCard title="Ganancia diaria" />
              <MetricCard title="Monto actual" />
              <MetricCard title="Pagos realizados" />
              <MetricCard title="Comparacion" />
            </div>

            <div className="panel-layout-grid">
              <div className="panel-left-stack">
                <BlockCard title="Caja en vivo" className="panel-large-block" />
                <BlockCard title="Movimientos" className="panel-large-block" />
              </div>

              <div className="panel-right-stack">
                <BlockCard title="Ranking" className="panel-side-block" />
                <BlockCard title="Registro de pagos" className="panel-side-block" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PanelControlFeature;
