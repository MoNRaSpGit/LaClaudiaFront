import MetricCard from './components/MetricCard';
import PanelModal from './components/PanelModal';
import LiveCartPanel from './components/LiveCartPanel';
import MovementsPanel from './components/MovementsPanel';
import RankingPanel from './components/RankingPanel';
import PaymentFormPanel from './components/PaymentFormPanel';
import { money } from './model/panelControl.formatters';
import { usePanelControlController } from './model/usePanelControlController';

function PanelControlFeature({ currentUser }) {
  const controller = usePanelControlController({ currentUser });

  return (
    <>
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-11">
            <section className="panel-hero mb-4">
              <div>
                <p className="panel-hero-kicker mb-1">Caja en vivo</p>
                <h1 className="panel-hero-title mb-1">Panel de control</h1>
                <p className="panel-hero-subtitle mb-0">{controller.todayLabel}  seguimiento fiino de caja, scanner y movimientos.</p>
              </div>
              <div className="panel-status-stack">
                <div className="panel-status-open">Abierta</div>
                <div className="panel-status-user">{controller.operatorName}</div>
              </div>
            </section>

            <section className="panel-section mb-4">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <h2 className="h5 mb-0 panel-section-title">Caja diaria</h2>
                {controller.dashboardError ? <small className="text-danger">{controller.dashboardError}</small> : null}
              </div>

              <div className="panel-grid-6-v2">
                {controller.metrics.map((item) => (
                  <MetricCard key={item.title} title={item.title} value={item.value} hint={item.hint} />
                ))}

                <article className="panel-metric-card-v2 panel-comparison-card">
                  <p className="panel-metric-title">Comparación</p>
                  <div className="panel-comparison-row mb-1">
                    <span>Hoy vs ayer</span>
                    <strong className={controller.comparisonClass}>{controller.percent(controller.comparisonVsYesterday)}</strong>
                  </div>
                  <div className="panel-comparison-values mb-2">
                    <span>{money(controller.comparison.today)}</span>
                    <span>{money(controller.comparison.yesterday)}</span>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary panel-comparison-btn" onClick={() => controller.setIsComparisonOpen(true)}>
                    Ver detalle
                  </button>
                </article>
              </div>
            </section>

            <div className="panel-layout-grid-v2 panel-sections-grid">
              <div className="panel-left-stack">
                <LiveCartPanel
                  operatorName={controller.operatorName}
                  liveEditor={controller.liveEditor}
                  hasLiveItems={controller.hasLiveItems}
                  liveTimeLabel={controller.liveTimeLabel}
                  liveTotal={controller.liveTotal}
                  liveItems={controller.liveItems}
                />

                <MovementsPanel
                  hasMovementItems={controller.hasMovementItems}
                  visibleMovementItems={controller.visibleMovementItems}
                  canExpandMovements={controller.canExpandMovements}
                  movementExpandLabel={controller.movementExpandLabel}
                  expandedMovementId={controller.expandedMovementId}
                  onToggleMovementDetail={controller.toggleMovementDetail}
                  onExpandMovements={controller.expandMovements}
                />
              </div>

              <div className="panel-right-stack">
                <RankingPanel
                  hasRankingItems={controller.hasRankingItems}
                  visibleRankingItems={controller.visibleRankingItems}
                  rankingDateLabel={controller.rankingDateLabel}
                  canExpandRanking={controller.canExpandRanking}
                  rankingExpandLabel={controller.rankingExpandLabel}
                  onExpandRanking={controller.expandRanking}
                />

                <PaymentFormPanel
                  paymentAmount={controller.paymentAmount}
                  paymentDescription={controller.paymentDescription}
                  paymentError={controller.paymentError}
                  onChangeAmount={controller.setPaymentAmount}
                  onChangeDescription={controller.setPaymentDescription}
                  onSubmit={controller.handleRegisterPayment}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {controller.isComparisonOpen ? (
        <PanelModal
          title="Comparación detallada"
          body={(
            <div className="d-grid gap-2">
              <div className="panel-detail-row"><span>Máximo (récord)</span><strong>{money(controller.comparison.record)}</strong></div>
              <div className="panel-detail-row"><span>Hoy</span><strong>{money(controller.comparison.today)}</strong></div>
              <div className="panel-detail-row"><span>Hoy vs récord</span><strong className={controller.comparisonVsRecord >= 0 ? 'panel-comparison-positive' : 'panel-comparison-negative'}>{controller.percent(controller.comparisonVsRecord)}</strong></div>
            </div>
          )}
          onClose={() => controller.setIsComparisonOpen(false)}
        />
      ) : null}
    </>
  );
}

export default PanelControlFeature;
