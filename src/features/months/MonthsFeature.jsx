import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, CalendarRange, Wallet, TrendingUp, Pencil } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import { moneyNoDecimals } from '../panelControl/model/panelControl.formatters';
import PanelModal from '../panelControl/components/PanelModal';
import { useMonthsController } from './model/useMonthsController';

const MONTHS_WEEK_EDIT_ENABLED = false;

function MonthsFeature({ currentUser, onUnauthorized }) {
  const unauthorizedHandledRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandledRef.current) {
      return;
    }
    unauthorizedHandledRef.current = true;
    toast.warn('Sesion vencida. Inicia sesion nuevamente.', {
      toastId: 'months-session-expired',
      autoClose: 1700
    });
    window.setTimeout(() => {
      onUnauthorized?.();
    }, 900);
  }, [onUnauthorized]);

  useEffect(() => {
    unauthorizedHandledRef.current = false;
  }, [currentUser?.sessionToken]);

  const controller = useMonthsController({
    currentUser,
    onUnauthorized: handleUnauthorized
  });

  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [editingWeek, setEditingWeek] = useState(null);
  const [salesDraft, setSalesDraft] = useState('');
  const [paymentsDraft, setPaymentsDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    const nextExpanded = {};
    controller.featuredMonthKeys.forEach((monthKey) => {
      if (monthKey) {
        nextExpanded[monthKey] = true;
      }
    });
    setExpandedMonths(nextExpanded);
  }, [controller.featuredMonthKeys]);

  const totals = useMemo(() => {
    return controller.months.reduce((acc, month) => ({
      sales: acc.sales + Number(month?.salesTotal || 0),
      profit: acc.profit + Number(month?.profitTotal || 0),
      payments: acc.payments + Number(month?.paymentsTotal || 0)
    }), {
      sales: 0,
      profit: 0,
      payments: 0
    });
  }, [controller.months]);

  function toggleMonth(monthKey) {
    setExpandedMonths((current) => ({
      ...current,
      [monthKey]: !current[monthKey]
    }));
  }

  function toggleWeek(monthKey, weekNumber) {
    const weekKey = `${monthKey}::${weekNumber}`;
    setExpandedWeeks((current) => ({
      ...current,
      [weekKey]: !current[weekKey]
    }));
  }

  function openWeekEditor(month, week) {
    setEditingWeek({
      monthKey: month.monthKey,
      monthLabel: month.label,
      weekNumber: week.weekNumber,
      weekLabel: week.label
    });
    setSalesDraft(String(week.salesTotal ?? 0));
    setPaymentsDraft(String(week.paymentsTotal ?? 0));
    setNoteDraft(String(week.overrideNote || ''));
  }

  function closeWeekEditor() {
    setEditingWeek(null);
    setSalesDraft('');
    setPaymentsDraft('');
    setNoteDraft('');
  }

  async function handleWeekOverrideSubmit(event) {
    event.preventDefault();
    if (!editingWeek) {
      return;
    }

    const parsedSales = Number(String(salesDraft || '0').replace(',', '.'));
    const parsedPayments = Number(String(paymentsDraft || '0').replace(',', '.'));

    if (!Number.isFinite(parsedSales) || parsedSales < 0) {
      toast.error('Ingresa un total de ventas valido.', {
        toastId: 'months-week-sales-invalid',
        autoClose: 2200
      });
      return;
    }

    if (!Number.isFinite(parsedPayments) || parsedPayments < 0) {
      toast.error('Ingresa un total de pagos valido.', {
        toastId: 'months-week-payments-invalid',
        autoClose: 2200
      });
      return;
    }

    try {
      const result = await controller.saveWeekOverride({
        monthKey: editingWeek.monthKey,
        weekNumber: editingWeek.weekNumber,
        salesTotal: parsedSales,
        paymentsTotal: parsedPayments,
        note: noteDraft
      });

      if (result?.busy) {
        return;
      }

      toast.success('Semana actualizada.', {
        toastId: `months-week-save-${editingWeek.monthKey}-${editingWeek.weekNumber}`,
        autoClose: 1800
      });
      closeWeekEditor();
    } catch (error) {
      toast.error(error?.message || 'No se pudo actualizar la semana.', {
        toastId: 'months-week-save-error',
        autoClose: 2200
      });
    }
  }

  return (
    <>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-10">
            <section className="panel-hero mb-4">
              <div>
                <p className="panel-hero-kicker mb-1">Historial</p>
                <h1 className="panel-hero-title mb-1">Meses</h1>
                <p className="panel-hero-subtitle mb-0">Resumen mensual de caja para reemplazar el cuaderno por una vista ordenada y facil de revisar.</p>
              </div>
              <div className="panel-status-pill">Admin</div>
            </section>

            <section className="panel-section mb-4">
              <div className="months-summary-grid">
                <article className="months-summary-card">
                  <span className="months-summary-icon"><CalendarRange size={16} /></span>
                  <div>
                    <p className="months-summary-label">Meses cargados</p>
                    <strong className="months-summary-value">{controller.months.length}</strong>
                  </div>
                </article>
                <article className="months-summary-card">
                  <span className="months-summary-icon"><Wallet size={16} /></span>
                  <div>
                    <p className="months-summary-label">Ventas acumuladas</p>
                    <strong className="months-summary-value">{moneyNoDecimals(totals.sales)}</strong>
                  </div>
                </article>
                <article className="months-summary-card">
                  <span className="months-summary-icon"><TrendingUp size={16} /></span>
                  <div>
                    <p className="months-summary-label">Ganancia estimada</p>
                    <strong className="months-summary-value">{moneyNoDecimals(totals.profit)}</strong>
                  </div>
                </article>
              </div>
            </section>

            {controller.isLoading ? (
              <div className="months-empty-state">
                <strong>Cargando meses...</strong>
                <p className="mb-0">Estamos armando el historial mensual con ventas y pagos reales.</p>
              </div>
            ) : null}

            {!controller.isLoading && controller.error ? (
              <div className="months-empty-state">
                <strong>No pudimos cargar el historial.</strong>
                <p className="mb-0">{controller.error}</p>
              </div>
            ) : null}

            {!controller.isLoading && !controller.error && !controller.months.length ? (
              <div className="months-empty-state">
                <strong>Sin meses disponibles todavia.</strong>
                <p className="mb-0">Cuando haya ventas o movimientos guardados, van a aparecer aca ordenados del mes mas reciente al mas viejo.</p>
              </div>
            ) : null}

            {!controller.isLoading && !controller.error && controller.months.length ? (
              <div className="months-list">
                {controller.months.map((month) => {
                  const monthKey = String(month?.monthKey || '');
                  const isExpanded = Boolean(expandedMonths[monthKey]);

                  return (
                    <article key={monthKey} className="months-card">
                      <button
                        type="button"
                        className="months-card-head"
                        onClick={() => toggleMonth(monthKey)}
                        aria-expanded={isExpanded}
                      >
                        <div className="months-card-head-copy">
                          <p className="months-card-kicker mb-1">{monthKey}</p>
                          <h2 className="months-card-title mb-1">{month?.label || monthKey}</h2>
                          <p className="months-card-subtitle mb-0">
                            Total del mes {moneyNoDecimals(month?.salesTotal)} | Ganancia estimada {moneyNoDecimals(month?.profitTotal)}
                          </p>
                        </div>
                        <div className="months-card-head-meta">
                          <span className="months-card-total">{moneyNoDecimals(month?.salesTotal)}</span>
                          <span className="months-card-toggle">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </span>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="months-card-body">
                          <div className="months-metric-strip">
                            <div className="months-mini-metric">
                              <span>Ventas</span>
                              <strong>{moneyNoDecimals(month?.salesTotal)}</strong>
                            </div>
                            <div className="months-mini-metric">
                              <span>Ganancia estimada</span>
                              <strong>{moneyNoDecimals(month?.profitTotal)}</strong>
                            </div>
                            <div className="months-mini-metric">
                              <span>Pagos</span>
                              <strong>{moneyNoDecimals(month?.paymentsTotal)}</strong>
                            </div>
                            <div className="months-mini-metric">
                              <span>Semanas</span>
                              <strong>{Number(month?.weeksCount || 0)}</strong>
                            </div>
                          </div>

                          {Array.isArray(month?.weeks) && month.weeks.length ? (
                            <div className="months-weeks-list">
                              {month.weeks.map((week) => (
                                <div key={`${monthKey}-${week.weekNumber}`} className="months-week-card">
                                  <div className="months-week-row">
                                    <button
                                      type="button"
                                      className="months-week-main"
                                      onClick={() => toggleWeek(monthKey, week.weekNumber)}
                                      aria-expanded={Boolean(expandedWeeks[`${monthKey}::${week.weekNumber}`])}
                                    >
                                      <div className="months-week-copy">
                                        <strong>{week.label}</strong>
                                        <span>{week.rangeLabel}</span>
                                        {week.isOverridden ? (
                                          <small className="months-week-override-flag">
                                            Ajustado manualmente{week.overrideNote ? ` | ${week.overrideNote}` : ''}
                                          </small>
                                        ) : null}
                                      </div>
                                      <div className="months-week-values">
                                        <div>
                                          <small>Ventas</small>
                                          <strong>{moneyNoDecimals(week.salesTotal)}</strong>
                                        </div>
                                        <div>
                                          <small>Ganancia estimada</small>
                                          <strong>{moneyNoDecimals(week.profitTotal)}</strong>
                                        </div>
                                        <div>
                                          <small>Pagos</small>
                                          <strong>{moneyNoDecimals(week.paymentsTotal)}</strong>
                                        </div>
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary months-week-edit-btn"
                                      onClick={() => openWeekEditor(month, week)}
                                      hidden={!MONTHS_WEEK_EDIT_ENABLED}
                                      aria-hidden={!MONTHS_WEEK_EDIT_ENABLED}
                                      tabIndex={MONTHS_WEEK_EDIT_ENABLED ? 0 : -1}
                                    >
                                      <Pencil size={14} />
                                      <span>Editar</span>
                                    </button>
                                  </div>

                                  {expandedWeeks[`${monthKey}::${week.weekNumber}`] ? (
                                    <div className="months-week-days">
                                      {week.isOverridden ? (
                                        <div className="months-week-override-note">
                                          El total semanal fue corregido manualmente. Los dias de abajo muestran los valores originales registrados dia por dia.
                                        </div>
                                      ) : null}
                                      {Array.isArray(week.days) && week.days.length ? (
                                        week.days.map((day) => (
                                          <div key={day.dateLabel} className={`months-day-row ${day.isOutsideMonth ? 'months-day-row-outside' : ''}`}>
                                            <div className="months-day-copy">
                                              <strong>{day.weekdayLabel}</strong>
                                              <span>{day.dateLabel}</span>
                                            </div>
                                            <div className="months-day-values">
                                              <div>
                                                <small>Ventas</small>
                                                <strong>{moneyNoDecimals(day.salesTotal)}</strong>
                                              </div>
                                              <div>
                                                <small>Pagos</small>
                                                <strong>{moneyNoDecimals(day.paymentsTotal)}</strong>
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="months-empty-inline">
                                          Esta semana todavia no tiene dias cargados.
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="months-empty-inline">
                              Este mes no tiene semanas con datos todavia.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {MONTHS_WEEK_EDIT_ENABLED && editingWeek ? (
        <PanelModal
          title={`Editar ${editingWeek.weekLabel}`}
          body={(
            <form className="d-grid gap-3" onSubmit={handleWeekOverrideSubmit}>
              <p className="mb-0 small text-muted">
                {editingWeek.monthLabel}. Ajusta ventas y pagos de esta semana. La ganancia se recalcula sola.
              </p>
              <div className="d-grid gap-2">
                <label className="small text-muted" htmlFor="months-sales-input">Ventas</label>
                <input
                  id="months-sales-input"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={salesDraft}
                  onChange={(event) => setSalesDraft(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="d-grid gap-2">
                <label className="small text-muted" htmlFor="months-payments-input">Pagos</label>
                <input
                  id="months-payments-input"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={paymentsDraft}
                  onChange={(event) => setPaymentsDraft(event.target.value)}
                />
              </div>
              <div className="d-grid gap-2">
                <label className="small text-muted" htmlFor="months-note-input">Nota</label>
                <input
                  id="months-note-input"
                  type="text"
                  maxLength={255}
                  className="form-control"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Ej: corregido segun cuaderno"
                />
              </div>
              <button type="submit" className="btn btn-dark w-100" disabled={controller.isSaving}>
                {controller.isSaving ? 'Guardando...' : 'Guardar ajuste'}
              </button>
            </form>
          )}
          onClose={closeWeekEditor}
        />
      ) : null}
    </>
  );
}

export default MonthsFeature;
