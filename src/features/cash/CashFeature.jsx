import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import {
  getMsUntilStoreHour,
  getNextStoreDateLabel,
  getStoreDateLabelForDate,
  INITIAL_CASH_PRELOAD_OPEN_HOUR,
  isInitialCashPreloadWindowOpen,
  moneyNoDecimals
} from '../panelControl/model/panelControl.formatters';
import { toUserErrorMessage } from '../../shared/lib/userErrorMessages';
import {
  fetchCashInitialCash,
  fetchCashInitialCashPreload,
  updateCashInitialCash,
  updateCashInitialCashPreload
} from './services/cash.api';

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function CashFeature({ currentUser, onUnauthorized }) {
  const unauthorizedHandledRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandledRef.current) {
      return;
    }
    unauthorizedHandledRef.current = true;
    toast.warn('Sesion vencida. Inicia sesion nuevamente.', {
      toastId: 'cash-session-expired',
      autoClose: 1700
    });
    window.setTimeout(() => {
      onUnauthorized?.();
    }, 900);
  }, [onUnauthorized]);

  useEffect(() => {
    unauthorizedHandledRef.current = false;
  }, [currentUser?.sessionToken]);

  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [initialCashAmount, setInitialCashAmount] = useState(0);
  const [canUpdateCurrentCash, setCanUpdateCurrentCash] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [isSavingInitialCash, setIsSavingInitialCash] = useState(false);
  const [initialCashDraft, setInitialCashDraft] = useState('0');

  const [nextInitialCashAmount, setNextInitialCashAmount] = useState(0);
  const [canPreloadNextDay, setCanPreloadNextDay] = useState(false);
  const [preloadError, setPreloadError] = useState('');
  const [isSavingPreload, setIsSavingPreload] = useState(false);
  const [preloadDraft, setPreloadDraft] = useState('0');

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const clockDate = useMemo(() => new Date(clockNowMs), [clockNowMs]);
  const currentStoreDateLabel = useMemo(() => getStoreDateLabelForDate(clockDate), [clockDate]);
  const nextStoreDateLabel = useMemo(() => getNextStoreDateLabel(clockDate), [clockDate]);
  const preloadWindowOpen = useMemo(() => isInitialCashPreloadWindowOpen(clockDate), [clockDate]);
  const msUntilPreloadOpen = useMemo(() => getMsUntilStoreHour(INITIAL_CASH_PRELOAD_OPEN_HOUR, clockDate), [clockDate]);
  const countdownLabel = useMemo(() => formatCountdown(msUntilPreloadOpen), [msUntilPreloadOpen]);
  const isCurrentCashLocked = !canUpdateCurrentCash;

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentInitialCash() {
      try {
        const result = await fetchCashInitialCash({
          date: currentStoreDateLabel,
          token: currentUser?.sessionToken || ''
        });

        if (!isMounted) {
          return;
        }

        const settings = result?.settings || {};
        const nextInitialCash = Number(settings.initialCash || 0);
        setInitialCashAmount(nextInitialCash);
        setCanUpdateCurrentCash(Boolean(settings.canUpdate));
        setInitialCashDraft(String(nextInitialCash || 0));
        setDashboardError('');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (Number(error?.status || 0) === 401) {
          handleUnauthorized();
          return;
        }

        setDashboardError(toUserErrorMessage(error, { context: 'panel_dashboard' }));
      }
    }

    loadCurrentInitialCash();

    return () => {
      isMounted = false;
    };
  }, [currentStoreDateLabel, currentUser?.sessionToken, handleUnauthorized]);

  useEffect(() => {
    let isMounted = true;

    async function loadNextDayPreload() {
      try {
        const result = await fetchCashInitialCashPreload({
          token: currentUser?.sessionToken || ''
        });

        if (!isMounted) {
          return;
        }

        const settings = result?.settings || {};
        const nextInitialCash = Number(settings.initialCash || 0);
        setNextInitialCashAmount(nextInitialCash);
        setCanPreloadNextDay(Boolean(settings.canPreload));
        setPreloadDraft(String(nextInitialCash || 0));
        setPreloadError('');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (Number(error?.status || 0) === 401) {
          handleUnauthorized();
          return;
        }

        setPreloadError(toUserErrorMessage(error, { context: 'panel_dashboard' }));
      }
    }

    loadNextDayPreload();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.sessionToken, nextStoreDateLabel, preloadWindowOpen, handleUnauthorized]);

  async function handleCurrentCashSubmit(event) {
    event.preventDefault();

    if (isCurrentCashLocked) {
      toast.info('La caja inicial de hoy ya fue cargada.', {
        toastId: 'cash-initial-cash-locked',
        autoClose: 2200
      });
      return;
    }

    try {
      setIsSavingInitialCash(true);
      const result = await updateCashInitialCash({
        date: currentStoreDateLabel,
        initialCash: initialCashDraft
      }, {
        token: currentUser?.sessionToken || ''
      });

      const settings = result?.settings || {};
      const nextInitialCash = Number(settings.initialCash || 0);
      setInitialCashAmount(nextInitialCash);
      setCanUpdateCurrentCash(Boolean(settings.canUpdate));
      setInitialCashDraft(String(nextInitialCash || 0));
      setDashboardError('');

      toast.success('Caja inicial actualizada.', {
        toastId: 'cash-initial-cash-ok',
        autoClose: 1800
      });
    } catch (error) {
      if (Number(error?.status || 0) === 401) {
        handleUnauthorized();
        return;
      }

      toast.error(error?.message || 'No se pudo guardar la caja inicial.', {
        toastId: 'cash-initial-cash-invalid',
        autoClose: 2200
      });
    } finally {
      setIsSavingInitialCash(false);
    }
  }

  async function handlePreloadSubmit(event) {
    event.preventDefault();

    if (!preloadWindowOpen || !canPreloadNextDay) {
      toast.info(`La pre-carga se habilita a las ${INITIAL_CASH_PRELOAD_OPEN_HOUR}:00.`, {
        toastId: 'cash-preload-closed',
        autoClose: 2200
      });
      return;
    }

    try {
      setIsSavingPreload(true);
      const result = await updateCashInitialCashPreload({
        date: nextStoreDateLabel,
        initialCash: preloadDraft
      }, {
        token: currentUser?.sessionToken || ''
      });

      const settings = result?.settings || {};
      const nextInitialCash = Number(settings.initialCash || 0);
      setNextInitialCashAmount(nextInitialCash);
      setCanPreloadNextDay(Boolean(settings.canPreload));
      setPreloadDraft(String(nextInitialCash || 0));
      setPreloadError('');

      toast.success('Pre-carga de manana guardada.', {
        toastId: 'cash-preload-ok',
        autoClose: 1800
      });
    } catch (error) {
      if (Number(error?.status || 0) === 401) {
        handleUnauthorized();
        return;
      }

      toast.error(error?.message || 'No se pudo guardar la pre-carga.', {
        toastId: 'cash-preload-invalid',
        autoClose: 2200
      });
    } finally {
      setIsSavingPreload(false);
    }
  }

  return (
    <>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-xl-6">
            <section className="panel-hero mb-4">
              <div>
                <p className="panel-hero-kicker mb-1">Operario</p>
                <h1 className="panel-hero-title mb-1">Caja</h1>
                <p className="panel-hero-subtitle mb-0">Gestiona la apertura de hoy y deja preparada la de manana sin tocar el panel admin.</p>
              </div>
              <div className="panel-status-stack">
                <div className="panel-status-open">Activa</div>
              </div>
            </section>

            <section className="panel-section mb-4">
              <div className="panel-cash-summary-grid">
                <article className="panel-metric-card-v2 panel-cash-summary-card">
                  <p className="panel-metric-title">Caja inicial actual</p>
                  <p className="panel-metric-value">{moneyNoDecimals(initialCashAmount)}</p>
                  <p className="panel-metric-hint">Monto de apertura configurado para {currentStoreDateLabel}.</p>
                </article>
              </div>
            </section>

            <article className="panel-block-v2 panel-block-accent-green mb-4">
              <div className="panel-block-header panel-block-title-cell">
                <h3 className="h6 mb-2">Caja de hoy</h3>
                <p className="panel-help mb-0">
                  {isCurrentCashLocked
                    ? 'La caja de hoy ya fue abierta y queda vigente hasta medianoche.'
                    : 'Si hoy todavia no se cargo una apertura, puedes registrarla desde aca.'}
                </p>
              </div>
              <div className="panel-block-content panel-block-data-cell">
                <form className="d-grid gap-2" onSubmit={handleCurrentCashSubmit}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    placeholder="Monto inicial"
                    value={initialCashDraft}
                    disabled={isSavingInitialCash || isCurrentCashLocked}
                    onChange={(event) => setInitialCashDraft(event.target.value)}
                    autoFocus
                  />
                  {isCurrentCashLocked ? (
                    <p className="panel-help mb-0">
                      Hoy ya existe una caja inicial cargada: <strong>{moneyNoDecimals(initialCashAmount)}</strong>.
                    </p>
                  ) : null}
                  {dashboardError ? <p className="app-inline-error mb-0">{dashboardError}</p> : null}
                  <button type="submit" className="btn btn-dark" disabled={isSavingInitialCash || isCurrentCashLocked}>
                    {isSavingInitialCash ? 'Guardando...' : 'Guardar caja inicial de hoy'}
                  </button>
                </form>
              </div>
            </article>

            <article className="panel-block-v2 panel-block-accent-blue">
              <div className="panel-block-header panel-block-title-cell">
                <h3 className="h6 mb-2">Pre-carga de manana</h3>
                <p className="panel-help mb-0">
                  Desde las {INITIAL_CASH_PRELOAD_OPEN_HOUR}:00 puedes dejar listo el monto que va a activarse automaticamente al comenzar el nuevo dia.
                </p>
              </div>
              <div className="panel-block-content panel-block-data-cell">
                {!preloadWindowOpen ? (
                  <div className="panel-cash-countdown-card">
                    <p className="panel-metric-title mb-1">Falta para habilitar pre-carga</p>
                    <p className="panel-cash-countdown-value mb-1">{countdownLabel}</p>
                    <p className="panel-help mb-0">
                      A las {INITIAL_CASH_PRELOAD_OPEN_HOUR}:00 se abre esta caja para cargar el valor de {nextStoreDateLabel}.
                    </p>
                  </div>
                ) : (
                  <form className="d-grid gap-2" onSubmit={handlePreloadSubmit}>
                    <div className="panel-cash-next-day-banner">
                      <span>Fecha destino</span>
                      <strong>{nextStoreDateLabel}</strong>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      placeholder="Monto para manana"
                      value={preloadDraft}
                      disabled={isSavingPreload || !canPreloadNextDay}
                      onChange={(event) => setPreloadDraft(event.target.value)}
                    />
                    <p className="panel-help mb-0">
                      Valor pre-cargado actual para manana: <strong>{moneyNoDecimals(nextInitialCashAmount)}</strong>.
                    </p>
                    {preloadError ? <p className="app-inline-error mb-0">{preloadError}</p> : null}
                    <button type="submit" className="btn btn-dark" disabled={isSavingPreload || !canPreloadNextDay}>
                      {isSavingPreload ? 'Guardando...' : 'Guardar pre-carga de manana'}
                    </button>
                  </form>
                )}
              </div>
            </article>
          </div>
        </div>
      </div>
    </>
  );
}

export default CashFeature;
