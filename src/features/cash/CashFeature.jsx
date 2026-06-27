import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import {
  getMsUntilNextStoreMidnight,
  getStoreDateLabel,
  moneyNoDecimals
} from '../panelControl/model/panelControl.formatters';
import { toUserErrorMessage } from '../../shared/lib/userErrorMessages';
import { fetchCashInitialCash, updateCashInitialCash } from './services/cash.api';

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

  const [currentStoreDateLabel, setCurrentStoreDateLabel] = useState(() => getStoreDateLabel());
  const [initialCashAmount, setInitialCashAmount] = useState(0);
  const [canUpdate, setCanUpdate] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [isSavingInitialCash, setIsSavingInitialCash] = useState(false);
  const [initialCashDraft, setInitialCashDraft] = useState('0');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentStoreDateLabel(getStoreDateLabel());
    }, getMsUntilNextStoreMidnight());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentStoreDateLabel]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialCash() {
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
        setCanUpdate(Boolean(settings.canUpdate));
        setDashboardError('');
        setInitialCashDraft(String(nextInitialCash || 0));
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

    loadInitialCash();

    return () => {
      isMounted = false;
    };
  }, [currentStoreDateLabel, currentUser?.sessionToken, handleUnauthorized]);

  const isInitialCashLocked = !canUpdate;

  async function handleSubmit(event) {
    event.preventDefault();

    if (isInitialCashLocked) {
      toast.info('La caja inicial de hoy ya fue cargada. Vas a poder ingresar una nueva cuando arranque el proximo dia.', {
        toastId: 'cash-initial-cash-locked',
        autoClose: 2600
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
      setCanUpdate(Boolean(settings.canUpdate ?? false));
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
                <p className="panel-hero-subtitle mb-0">Carga la apertura del dia cuando todavia no exista una caja inicial registrada.</p>
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

            <article className="panel-block-v2 panel-block-accent-green">
              <div className="panel-block-header panel-block-title-cell">
                <h3 className="h6 mb-2">Ingresar caja inicial</h3>
                <p className="panel-help mb-0">
                  {isInitialCashLocked
                    ? 'La caja de hoy ya fue abierta. Cuando cambie el dia en el sistema y vuelva a quedar en 0, desde aca se podra ingresar la nueva apertura.'
                    : 'Este valor impacta en la caja diaria que ve administracion.'}
                </p>
              </div>
              <div className="panel-block-content panel-block-data-cell">
                <form className="d-grid gap-2" onSubmit={handleSubmit}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    placeholder="Monto inicial"
                    value={initialCashDraft}
                    disabled={isSavingInitialCash || isInitialCashLocked}
                    onChange={(event) => setInitialCashDraft(event.target.value)}
                    autoFocus
                  />
                  {isInitialCashLocked ? (
                    <p className="panel-help mb-0">
                      Hoy ya existe una caja inicial cargada: <strong>{moneyNoDecimals(initialCashAmount)}</strong>. Ese valor queda vigente hasta la medianoche.
                    </p>
                  ) : null}
                  {dashboardError ? <p className="app-inline-error mb-0">{dashboardError}</p> : null}
                  <button type="submit" className="btn btn-dark" disabled={isSavingInitialCash || isInitialCashLocked}>
                    {isSavingInitialCash ? 'Guardando...' : 'Guardar caja inicial'}
                  </button>
                </form>
              </div>
            </article>
          </div>
        </div>
      </div>
    </>
  );
}

export default CashFeature;
