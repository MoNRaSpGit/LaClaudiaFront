import { useCallback, useEffect, useRef, useState } from 'react';
import { Wallet, Radio, Trophy, ArrowLeftRight, HandCoins } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import MetricCard from './components/MetricCard';
import PanelModal from './components/PanelModal';
import LiveCartPanel from './components/LiveCartPanel';
import MovementsPanel from './components/MovementsPanel';
import RankingPanel from './components/RankingPanel';
import PaymentFormPanel from './components/PaymentFormPanel';
import { moneyNoDecimals } from './model/panelControl.formatters';
import { usePanelControlController } from './model/usePanelControlController';

function PanelControlFeature({ currentUser, onUnauthorized }) {
  const unauthorizedHandledRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandledRef.current) {
      return;
    }
    unauthorizedHandledRef.current = true;
    toast.warn('Sesion vencida. Inicia sesion nuevamente.', {
      toastId: 'panel-session-expired',
      autoClose: 1700
    });
    window.setTimeout(() => {
      onUnauthorized?.();
    }, 900);
  }, [onUnauthorized]);

  useEffect(() => {
    unauthorizedHandledRef.current = false;
  }, [currentUser?.sessionToken]);

  const controller = usePanelControlController({
    currentUser,
    onUnauthorized: handleUnauthorized
  });
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [activeMobileSection, setActiveMobileSection] = useState('daily');
  const [isInitialCashModalOpen, setIsInitialCashModalOpen] = useState(false);
  const [initialCashDraft, setInitialCashDraft] = useState(() => String(controller.initialCashAmount || 0));
  const [isProfitRateModalOpen, setIsProfitRateModalOpen] = useState(false);
  const [profitRateDraft, setProfitRateDraft] = useState(() => String(controller.profitRatePercent || 30));

  useEffect(() => {
    function syncMobileLayout() {
      if (typeof window === 'undefined') {
        return;
      }
      setIsMobileLayout(window.innerWidth < 992);
    }

    syncMobileLayout();
    window.addEventListener('resize', syncMobileLayout);
    return () => {
      window.removeEventListener('resize', syncMobileLayout);
    };
  }, []);

  useEffect(() => {
    setInitialCashDraft(String(controller.initialCashAmount || 0));
  }, [controller.initialCashAmount]);

  useEffect(() => {
    setProfitRateDraft(String(controller.profitRatePercent || 30));
  }, [controller.profitRatePercent]);

  function openInitialCashModal() {
    setInitialCashDraft(String(controller.initialCashAmount || 0));
    setIsInitialCashModalOpen(true);
  }

  function openProfitRateModal() {
    setProfitRateDraft(String(controller.profitRatePercent || 30));
    setIsProfitRateModalOpen(true);
  }

  function closeInitialCashModal() {
    setIsInitialCashModalOpen(false);
    setInitialCashDraft(String(controller.initialCashAmount || 0));
  }

  function closeProfitRateModal() {
    setIsProfitRateModalOpen(false);
    setProfitRateDraft(String(controller.profitRatePercent || 30));
  }

  async function saveInitialCash() {
    try {
      const result = await controller.saveInitialCash(initialCashDraft);
      if (result?.busy) {
        return;
      }
      setIsInitialCashModalOpen(false);
      toast.success('Caja inicial actualizada.', {
        toastId: 'panel-initial-cash-ok',
        autoClose: 1800
      });
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la caja inicial.', {
        toastId: 'panel-initial-cash-invalid',
        autoClose: 2200
      });
    }
  }

  async function handleInitialCashSubmit(event) {
    event.preventDefault();
    await saveInitialCash();
  }

  async function handlePaymentSubmit(event) {
    const result = controller.handleRegisterPayment(event, {
      onSuccess: ({ elapsedMs, serverElapsedMs, serverDbElapsedMs, serverAppElapsedMs }) => {
        const networkApproxMs = elapsedMs > 0 && serverElapsedMs > 0
          ? Number((elapsedMs - serverElapsedMs).toFixed(1))
          : null;
        const serverLabel = serverElapsedMs ?? '-';
        const dbLabel = serverDbElapsedMs ?? '-';
        const appLabel = serverAppElapsedMs ?? '-';
        const netLabel = networkApproxMs ?? '-';
        if (elapsedMs > 0) {
          if (elapsedMs <= 500) {
            console.info(`[PAYMENT][OK] total=${elapsedMs} ms server=${serverLabel} ms db=${dbLabel} ms app=${appLabel} ms net~=${netLabel} ms`);
          } else {
            console.warn(`[PAYMENT][LENTO] total=${elapsedMs} ms server=${serverLabel} ms db=${dbLabel} ms app=${appLabel} ms net~=${netLabel} ms (> 500 ms)`);
          }
        }
      },
      onError: () => {
        toast.error('Hubo un error en el ultimo pago. Revisa conexion y reintenta.', {
          toastId: `panel-payment-fail-${Date.now()}`,
          autoClose: 2600
        });
      }
    });
    if (result?.ok) {
      toast.success('Pago registrado correctamente', {
        toastId: `panel-payment-ok-${Date.now()}`,
        autoClose: 1800
      });
    }
  }

  function saveProfitRate() {
    try {
      controller.updateProfitRate(profitRateDraft);
      setIsProfitRateModalOpen(false);
      toast.success('Porcentaje de ganancia actualizado.', {
        toastId: 'panel-profit-rate-ok',
        autoClose: 1800
      });
    } catch (error) {
      toast.error(error?.message || 'No se pudo actualizar el porcentaje.', {
        toastId: 'panel-profit-rate-invalid',
        autoClose: 2200
      });
    }
  }

  function handleProfitRateSubmit(event) {
    event.preventDefault();
    saveProfitRate();
  }

  function scrollToSection(sectionKey) {
    setActiveMobileSection(sectionKey);
    const sectionIdByKey = {
      daily: 'panel-section-daily',
      live: 'panel-section-live',
      ranking: 'panel-section-ranking',
      movements: 'panel-section-movements',
      payments: 'panel-section-payments'
    };
    const targetId = sectionIdByKey[sectionKey];
    const target = typeof document !== 'undefined' ? document.getElementById(targetId) : null;
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  function renderLivePanel() {
    return (
      <LiveCartPanel
        operatorName={controller.operatorName}
        liveEditor={controller.liveEditor}
        hasLiveItems={controller.hasLiveItems}
        liveTimeLabel={controller.liveTimeLabel}
        liveTotal={controller.liveTotal}
        liveItems={controller.liveItems}
      />
    );
  }

  function renderMovementsPanel() {
    return (
      <MovementsPanel
        hasMovementItems={controller.hasMovementItems}
        visibleMovementItems={controller.visibleMovementItems}
        canExpandMovements={controller.canExpandMovements}
        movementExpandLabel={controller.movementExpandLabel}
        expandedMovementId={controller.expandedMovementId}
        onToggleMovementDetail={controller.toggleMovementDetail}
        onExpandMovements={controller.expandMovements}
      />
    );
  }

  function renderRankingPanel() {
    return (
      <RankingPanel
        hasRankingItems={controller.hasRankingItems}
        visibleRankingItems={controller.visibleRankingItems}
        rankingDateLabel={controller.rankingDateLabel}
        canExpandRanking={controller.canExpandRanking}
        rankingExpandLabel={controller.rankingExpandLabel}
        onExpandRanking={controller.expandRanking}
      />
    );
  }

  function renderPaymentPanel() {
    return (
      <PaymentFormPanel
        paymentAmount={controller.paymentAmount}
        paymentDescription={controller.paymentDescription}
        paymentError={controller.paymentError}
        isRegisteringPayment={controller.isRegisteringPayment}
        onChangeAmount={controller.setPaymentAmount}
        onChangeDescription={controller.setPaymentDescription}
        onSubmit={handlePaymentSubmit}
      />
    );
  }

  return (
    <>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />
      <div className={`container py-4 ${isMobileLayout ? 'panel-mobile-page' : ''}`}>
        <div className="row justify-content-center">
          <div className="col-xl-11">
            <section className="panel-hero mb-4" id="panel-section-daily">
              <div>
                <p className="panel-hero-kicker mb-1">Caja en vivo</p>
                <h1 className="panel-hero-title mb-1">Panel de control</h1>
                <p className="panel-hero-subtitle mb-0">{controller.todayLabel} seguimiento fino de caja, scanner y movimientos.</p>
              </div>
              <div className="panel-status-stack">
                <div className="panel-status-open">Abierta</div>
              </div>
            </section>

            <section className="panel-section mb-4">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <h2 className="h5 mb-0 panel-section-title">Caja diaria</h2>
                <div className="d-flex align-items-center gap-2">
                  {controller.dashboardError ? <small className="text-danger">{controller.dashboardError}</small> : null}
                </div>
              </div>

              <div className="panel-grid-6-v2">
                {controller.metrics.map((item) => (
                  <MetricCard
                    key={item.title}
                    title={item.title}
                    value={item.value}
                    hint={item.hint}
                    onDoubleClick={item.title === 'Caja inicial'
                      ? openInitialCashModal
                      : (item.title === 'Ganancia diaria' ? openProfitRateModal : undefined)}
                  />
                ))}

                <article className="panel-metric-card-v2 panel-comparison-card">
                  <p className="panel-metric-title">Comparación</p>
                  <div className="panel-comparison-row mb-1">
                    <span>Hoy vs ayer</span>
                    <strong className={controller.comparisonClass}>{controller.percent(controller.comparisonVsYesterday)}</strong>
                  </div>
                  <div className="panel-comparison-values mb-2">
                    <span>{moneyNoDecimals(controller.comparison.today)}</span>
                    <span>{moneyNoDecimals(controller.comparison.yesterday)}</span>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary panel-comparison-btn" onClick={() => controller.setIsComparisonOpen(true)}>
                    Ver detalle
                  </button>
                </article>
              </div>
            </section>

            {isMobileLayout ? (
              <div className="panel-mobile-stack">
                <section id="panel-section-live">{renderLivePanel()}</section>
                <section id="panel-section-ranking">{renderRankingPanel()}</section>
                <section id="panel-section-movements">{renderMovementsPanel()}</section>
                <section id="panel-section-payments">{renderPaymentPanel()}</section>
              </div>
            ) : (
              <div className="panel-layout-grid-v2 panel-sections-grid">
                <div className="panel-left-stack">
                  {renderLivePanel()}
                  {renderMovementsPanel()}
                </div>

                <div className="panel-right-stack">
                  {renderRankingPanel()}
                  {renderPaymentPanel()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobileLayout ? (
        <nav className="panel-mobile-bottom-nav" aria-label="Navegación de secciones del panel">
          <button type="button" className={`panel-mobile-bottom-btn ${activeMobileSection === 'daily' ? 'panel-mobile-bottom-btn-active' : ''}`} onClick={() => scrollToSection('daily')}>
            <Wallet size={16} />
            <span>Caja</span>
          </button>
          <button type="button" className={`panel-mobile-bottom-btn ${activeMobileSection === 'live' ? 'panel-mobile-bottom-btn-active' : ''}`} onClick={() => scrollToSection('live')}>
            <Radio size={16} />
            <span>En vivo</span>
          </button>
          <button type="button" className={`panel-mobile-bottom-btn ${activeMobileSection === 'ranking' ? 'panel-mobile-bottom-btn-active' : ''}`} onClick={() => scrollToSection('ranking')}>
            <Trophy size={16} />
            <span>Ranking</span>
          </button>
          <button type="button" className={`panel-mobile-bottom-btn ${activeMobileSection === 'movements' ? 'panel-mobile-bottom-btn-active' : ''}`} onClick={() => scrollToSection('movements')}>
            <ArrowLeftRight size={16} />
            <span>Mov.</span>
          </button>
          <button type="button" className={`panel-mobile-bottom-btn ${activeMobileSection === 'payments' ? 'panel-mobile-bottom-btn-active' : ''}`} onClick={() => scrollToSection('payments')}>
            <HandCoins size={16} />
            <span>Pago</span>
          </button>
        </nav>
      ) : null}

      {isInitialCashModalOpen ? (
        <PanelModal
          title="Editar caja inicial"
          body={(
            <form className="d-grid gap-3" onSubmit={handleInitialCashSubmit}>
              <p className="mb-0 small text-muted">Por defecto arranca en 0. Hace doble click en la tarjeta para editarla otra vez.</p>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={initialCashDraft}
                onChange={(event) => setInitialCashDraft(event.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-dark w-100" disabled={controller.isSavingInitialCash}>
                {controller.isSavingInitialCash ? 'Guardando...' : 'Guardar'}
              </button>
            </form>
          )}
          onClose={closeInitialCashModal}
        />
      ) : null}

      {isProfitRateModalOpen ? (
        <PanelModal
          title="Editar porcentaje de ganancia"
          body={(
            <form className="d-grid gap-3" onSubmit={handleProfitRateSubmit}>
              <p className="mb-0 small text-muted">Doble click en la tarjeta de Ganancia diaria para editar este porcentaje otra vez.</p>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="form-control"
                value={profitRateDraft}
                onChange={(event) => setProfitRateDraft(event.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-dark w-100">
                Guardar
              </button>
            </form>
          )}
          onClose={closeProfitRateModal}
        />
      ) : null}

      {controller.isComparisonOpen ? (
        <PanelModal
          title="Comparación detallada"
          body={(
            <div className="d-grid gap-2">
              <div className="panel-detail-row"><span>Máximo (récord)</span><strong>{moneyNoDecimals(controller.comparison.record)}</strong></div>
              <div className="panel-detail-row"><span>Hoy</span><strong>{moneyNoDecimals(controller.comparison.today)}</strong></div>
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


