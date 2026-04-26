import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  registerPayment,
  selectPanelComparison,
  selectPanelMetrics,
  selectPanelMovements,
  selectPanelRanking
} from './panelControlSlice';

const todayLabel = new Intl.DateTimeFormat('es-UY', {
  weekday: 'long',
  day: '2-digit',
  month: 'long'
}).format(new Date());
const SIMULATE_EDITING_BANNER = true;

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function percent(value) {
  const normalized = Number(value || 0);
  const sign = normalized > 0 ? '+' : '';
  return `${sign}${normalized.toFixed(2)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return { date: '--/--/----', time: '--:--:--' };
  }

  const dateObj = new Date(value);
  return {
    date: new Intl.DateTimeFormat('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(dateObj),
    time: new Intl.DateTimeFormat('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(dateObj)
  };
}

function renderLiveEditorPrice(draft = {}) {
  const raw = draft.precio_venta_raw;
  if (raw === '') {
    return '$-';
  }
  const numeric = Number(draft.precio_venta || 0);
  return money(Number.isFinite(numeric) ? numeric : 0);
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
  const dispatch = useDispatch();
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [expandedMovementId, setExpandedMovementId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const panelMetrics = useSelector(selectPanelMetrics);
  const comparison = useSelector(selectPanelComparison);
  const movementItems = useSelector(selectPanelMovements);
  const rankingItems = useSelector(selectPanelRanking);
  const liveCartItems = useSelector((state) => state.scanner.cartItems);
  const liveLastScannedAt = useSelector((state) => state.scanner.lastScannedAt);
  const liveEditorState = useSelector((state) => state.scanner.liveEditor);
  const liveEditor = liveEditorState || (
    SIMULATE_EDITING_BANNER
      ? {
          type: 'edit',
          title: 'Editando producto',
          description: 'La caja ve en vivo los cambios del producto mientras el modal sigue abierto.',
          draft: {
            nombre: 'Yogur 1 litro Caldi',
            precio_venta: 145
          }
        }
      : null
  );

  const liveItems = useMemo(() => liveCartItems.map((item) => ({
    id: item.id,
    nombre: item.nombre,
    quantity: Number(item.quantity || 1),
    precio: Number(item.precio_venta || 0)
  })), [liveCartItems]);

  const liveTotal = useMemo(
    () => liveItems.reduce((acc, item) => acc + item.precio * item.quantity, 0),
    [liveItems]
  );

  const liveTimeLabel = useMemo(() => {
    if (!liveLastScannedAt) {
      return '--:--:--';
    }

    return new Intl.DateTimeFormat('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date(liveLastScannedAt));
  }, [liveLastScannedAt]);

  const comparisonVsYesterday = useMemo(() => {
    if (!comparison.yesterday) return 0;
    return ((comparison.today - comparison.yesterday) / comparison.yesterday) * 100;
  }, [comparison.today, comparison.yesterday]);

  const comparisonVsRecord = useMemo(() => {
    if (!comparison.record) return 0;
    return ((comparison.today - comparison.record) / comparison.record) * 100;
  }, [comparison.today, comparison.record]);

  const comparisonClass = comparisonVsYesterday >= 0 ? 'panel-comparison-positive' : 'panel-comparison-negative';
  const hasLiveItems = liveItems.length > 0;
  const hasMovementItems = movementItems.length > 0;
  const hasRankingItems = rankingItems.length > 0;
  const hasLiveEditor = Boolean(liveEditor);
  const operatorName = 'Admin Nuevo';

  const metrics = [
    { title: 'Caja inicial', value: money(panelMetrics.initialCash), hint: 'Monto de apertura del dia.' },
    { title: 'Ventas del dia', value: money(panelMetrics.salesToday), hint: 'Confirmadas por boton Cobrar' },
    { title: 'Ganancia diaria', value: money(panelMetrics.profitToday), hint: '20% de ventas del dia' },
    { title: 'Monto actual', value: money(panelMetrics.currentAmount), hint: 'Caja diaria + ventas - pagos' },
    { title: 'Pagos realizados', value: money(panelMetrics.paymentsTotal), hint: 'Suma de pagos registrados' }
  ];

  function toggleMovementDetail(movementId) {
    setExpandedMovementId((current) => (current === movementId ? null : movementId));
  }

  function handleRegisterPayment(event) {
    event.preventDefault();

    const normalized = String(paymentAmount || '').replace(',', '.').trim();
    const parsedAmount = Number(normalized);
    const trimmedDescription = String(paymentDescription || '').trim();

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setPaymentError('Ingresa un monto valido mayor a 0.');
      return;
    }

    dispatch(
      registerPayment({
        id: `payment-${Date.now()}`,
        amount: Number(parsedAmount.toFixed(2)),
        description: trimmedDescription,
        createdAt: new Date().toISOString()
      })
    );

    setPaymentAmount('');
    setPaymentDescription('');
    setPaymentError('');
  }

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
        <p className="panel-movement-detail-title mb-1">Pago</p>
        <p className="mb-0">{item.detail.description}</p>
      </div>
    );
  }

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

            <section className="panel-section mb-4">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <h2 className="h5 mb-0 panel-section-title">Caja diaria</h2>
              </div>

              <div className="panel-grid-6-v2">
                {metrics.map((item) => (
                  <MetricCard key={item.title} title={item.title} value={item.value} hint={item.hint} />
                ))}

                <article className="panel-metric-card-v2 panel-comparison-card">
                  <p className="panel-metric-title">Comparacion</p>
                  <div className="panel-comparison-row mb-1">
                    <span>Hoy vs ayer</span>
                    <strong className={comparisonClass}>{percent(comparisonVsYesterday)}</strong>
                  </div>
                  <div className="panel-comparison-values mb-2">
                    <span>{money(comparison.today)}</span>
                    <span>{money(comparison.yesterday)}</span>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary panel-comparison-btn" onClick={() => setIsComparisonOpen(true)}>
                    Ver detalle
                  </button>
                </article>
              </div>
            </section>

            <div className="panel-layout-grid-v2 panel-sections-grid">
              <div className="panel-left-stack">
                <article className="panel-block-v2 panel-large-block panel-block-accent-green">
                  <div className="panel-block-header panel-block-title-cell">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h3 className="h6 mb-0">Caja en vivo</h3>
                      <span className="badge text-bg-success">En vivo</span>
                    </div>
                    <p className="panel-help mb-0">Espejo en tiempo real de lo que arma el operario en el scanner.</p>
                    {hasLiveEditor ? (
                      <div className="panel-live-alert">
                        <p className="panel-live-alert-title mb-1">{liveEditor.title}</p>
                        {liveEditor.draft ? (
                          <div className="panel-live-alert-preview">
                            <span>{liveEditor.draft.nombre === '' ? '(vacio)' : (liveEditor.draft.nombre || 'Producto sin nombre')}</span>
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
                        <p className="panel-empty-title mb-1">Sin productos escaneados todavia</p>
                        <p className="panel-empty-text mb-0">Cuando el operario agregue o quite productos, la caja se va a clonar aca al instante.</p>
                      </div>
                    )}
                  </div>
                </article>

                <article className="panel-block-v2 panel-large-block panel-block-accent-blue">
                  <div className="panel-block-header panel-block-title-cell">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h3 className="h6 mb-0">Movimientos</h3>
                      <button type="button" className="btn btn-sm btn-outline-secondary">Ver mas</button>
                    </div>
                    <p className="panel-help mb-0">Resumen compacto de ventas y pagos confirmados.</p>
                  </div>
                  <div className="panel-block-content panel-block-data-cell">
                    {hasMovementItems ? (
                      <div className="panel-movements-list">
                        {movementItems.map((item) => {
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
                                  onClick={() => toggleMovementDetail(item.id)}
                                >
                                  {expandedMovementId === item.id ? 'Ocultar' : 'Detalle'}
                                </button>
                              </div>
                            </div>
                            {expandedMovementId === item.id ? (
                              renderMovementDetail(item)
                            ) : null}
                          </div>
                        );
                        })}
                      </div>
                    ) : (
                      <div className="panel-empty-state">
                        <p className="panel-empty-title mb-1">Sin movimientos recientes</p>
                        <p className="panel-empty-text mb-0">Cuando haya ventas confirmadas o pagos registrados, van a aparecer aca.</p>
                      </div>
                    )}
                  </div>
                </article>
              </div>

              <div className="panel-right-stack">
                <article className="panel-block-v2 panel-side-block panel-block-accent-violet">
                  <div className="panel-block-header panel-block-title-cell">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h3 className="h6 mb-0">Ranking</h3>
                      <button type="button" className="btn btn-sm btn-outline-secondary">Ver mas</button>
                    </div>
                    <p className="panel-help mb-0">Top 5 productos por cantidad vendida.</p>
                  </div>
                  <div className="panel-block-content panel-block-data-cell">
                    {hasRankingItems ? (
                      <ol className="panel-ranking-list mb-0">
                        {rankingItems.map((item) => (
                          <li key={item.name}>
                            <span>{item.name}</span>
                            <strong>{item.qty}</strong>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="panel-empty-state">
                        <p className="panel-empty-title mb-1">Sin ranking disponible</p>
                        <p className="panel-empty-text mb-0">El ranking aparece cuando se registran ventas con productos.</p>
                      </div>
                    )}
                  </div>
                </article>

                <article className="panel-block-v2 panel-side-block panel-block-accent-orange">
                  <div className="panel-block-header panel-block-title-cell">
                    <h3 className="h6 mb-2">Registrar pago</h3>
                    <p className="panel-help mb-0">Movimientos manuales, en formato liviano.</p>
                  </div>
                  <div className="panel-block-content panel-block-data-cell">
                    <form className="d-grid gap-2" onSubmit={handleRegisterPayment}>
                      <input
                        className="form-control"
                        placeholder="Monto"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                      />
                      <input
                        className="form-control"
                        placeholder="Descripcion"
                        value={paymentDescription}
                        onChange={(event) => setPaymentDescription(event.target.value)}
                      />
                      {paymentError ? <small className="text-danger">{paymentError}</small> : null}
                      <button type="submit" className="btn btn-dark">Registrar pago</button>
                    </form>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isComparisonOpen ? (
        <PanelModal
          title="Comparacion detallada"
          body={(
            <div className="d-grid gap-2">
              <div className="panel-detail-row"><span>Maximo (record)</span><strong>{money(comparison.record)}</strong></div>
              <div className="panel-detail-row"><span>Hoy</span><strong>{money(comparison.today)}</strong></div>
              <div className="panel-detail-row"><span>Hoy vs record</span><strong className={comparisonVsRecord >= 0 ? 'panel-comparison-positive' : 'panel-comparison-negative'}>{percent(comparisonVsRecord)}</strong></div>
            </div>
          )}
          onClose={() => setIsComparisonOpen(false)}
        />
      ) : null}
    </>
  );
}

export default PanelControlFeature;
