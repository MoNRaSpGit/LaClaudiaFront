import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parsePositiveAmount } from '../../../shared/lib/number';
import { toUserErrorMessage } from '../../../shared/lib/userErrorMessages';
import { flushScannerDiagnosticQueue } from '../../scanner/services/scanner.diagnostics';
import { closeScannerShift, fetchScannerShiftState, openScannerShift, resetScannerShifts } from '../../scanner/services/scanner.shifts.api';
import {
  canViewPanelDiagnostics,
  normalizeDiagnosticEvent
} from './panelControl.diagnostics';
import {
  fetchPanelDiagnosticEvents,
  registerPanelPayment,
  subscribePanelDashboard,
  updatePanelInitialCash
} from '../services/panelControl.api';
import {
  getMsUntilNextStoreMidnight,
  getStoreDateLabel,
  getTodayLabel,
  moneyNoDecimals,
  parseDateInput,
  percent,
  STORE_TIME_ZONE
} from './panelControl.formatters';

const EMPTY_DASHBOARD = {
  metrics: {
    initialCash: 0,
    salesToday: 0,
    profitToday: 0,
    currentAmount: 0,
    paymentsTotal: 0,
    customerAccountPaymentsTotal: 0,
    customerAccountPaymentsCashTotal: 0,
    customerAccountPaymentsCardTotal: 0,
    nonCashPendingTotal: 0,
    outstandingDebtTotal: 0,
    profitRate: 0.4
  },
  salesByPaymentMethod: {
    efectivo: 0,
    tarjeta: 0,
    cuenta: 0
  },
  comparison: {
    today: 0,
    yesterday: 0,
    record: 0
  },
  movements: [],
  ranking: []
};
const PANEL_LIVE_SLOW_MS = 300;
const PANEL_YESTERDAY_BOOTSTRAP_DATE = '2026-04-30';
const PANEL_YESTERDAY_BOOTSTRAP_AMOUNT = 5000;
const DEFAULT_PROFIT_RATE = 0.3;
const DIAGNOSTIC_POLL_MS = 15000;

export function usePanelControlController({ currentUser, onUnauthorized }) {
  const canViewDiagnostics = canViewPanelDiagnostics(currentUser);
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [remoteLiveScanner, setRemoteLiveScanner] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [expandedMovementId, setExpandedMovementId] = useState(null);
  const [visibleMovementsCount, setVisibleMovementsCount] = useState(3);
  const [visibleRankingCount, setVisibleRankingCount] = useState(5);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [currentStoreDateLabel, setCurrentStoreDateLabel] = useState(() => getStoreDateLabel());
  const [isSavingInitialCash, setIsSavingInitialCash] = useState(false);
  const [profitRate, setProfitRate] = useState(DEFAULT_PROFIT_RATE);
  const [diagnosticEvents, setDiagnosticEvents] = useState([]);
  const [diagnosticFilter, setDiagnosticFilter] = useState('all');
  const [diagnosticEventsError, setDiagnosticEventsError] = useState('');
  const [isLoadingDiagnosticEvents, setIsLoadingDiagnosticEvents] = useState(false);
  const [shiftState, setShiftState] = useState({
    date: null,
    shifts: [],
    activeShift: null,
    isLoading: true,
    error: ''
  });
  const [isSavingShift, setIsSavingShift] = useState(false);
  const lastLiveSnapshotKeyRef = useRef('');
  const diagnosticEventsRequestRef = useRef(0);
  const shiftStateRequestRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentStoreDateLabel(getStoreDateLabel());
    }, getMsUntilNextStoreMidnight());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentStoreDateLabel]);

  const loadDiagnosticEvents = useCallback(async ({ silent = false } = {}) => {
    if (!currentUser?.sessionToken || !canViewDiagnostics) {
      setDiagnosticEvents([]);
      setDiagnosticEventsError('');
      setIsLoadingDiagnosticEvents(false);
      return { ok: false };
    }

    const requestId = diagnosticEventsRequestRef.current + 1;
    diagnosticEventsRequestRef.current = requestId;
    if (!silent) {
      setIsLoadingDiagnosticEvents(true);
    }

    try {
      await flushScannerDiagnosticQueue({
        token: currentUser?.sessionToken || ''
      }).catch(() => {});
      const result = await fetchPanelDiagnosticEvents({ limit: 18 }, {
        token: currentUser?.sessionToken || ''
      });
      if (diagnosticEventsRequestRef.current !== requestId) {
        return { ok: false };
      }

      const nextEvents = (Array.isArray(result?.events) ? result.events : [])
        .map((event, index) => normalizeDiagnosticEvent(event, index))
        .sort((left, right) => (right.createdAtMs || 0) - (left.createdAtMs || 0));

      setDiagnosticEvents(nextEvents);
      setDiagnosticEventsError('');
      return {
        ok: true,
        events: nextEvents
      };
    } catch (error) {
      if (diagnosticEventsRequestRef.current !== requestId) {
        return { ok: false };
      }

      const message = toUserErrorMessage(error, { context: 'panel_dashboard' });
      setDiagnosticEventsError(message);
      return {
        ok: false,
        error: message
      };
    } finally {
      if (diagnosticEventsRequestRef.current === requestId) {
        setIsLoadingDiagnosticEvents(false);
      }
    }
  }, [canViewDiagnostics, currentUser?.sessionToken]);

  const loadShiftState = useCallback(async ({ silent = false } = {}) => {
    if (!currentUser?.sessionToken) {
      setShiftState({
        date: null,
        shifts: [],
        activeShift: null,
        isLoading: false,
        error: ''
      });
      return { ok: false };
    }

    const requestId = shiftStateRequestRef.current + 1;
    shiftStateRequestRef.current = requestId;
    if (!silent) {
      setShiftState((current) => ({
        ...current,
        isLoading: true,
        error: ''
      }));
    }

    try {
      const response = await fetchScannerShiftState({
        token: currentUser.sessionToken,
        date: currentStoreDateLabel
      });
      if (shiftStateRequestRef.current !== requestId) {
        return { ok: false };
      }

      const nextShiftState = response?.shiftState || {
        date: currentStoreDateLabel,
        shifts: [],
        activeShift: null
      };
      setShiftState({
        date: nextShiftState.date || currentStoreDateLabel,
        shifts: Array.isArray(nextShiftState.shifts) ? nextShiftState.shifts : [],
        activeShift: nextShiftState.activeShift || null,
        isLoading: false,
        error: ''
      });
      return {
        ok: true,
        shiftState: nextShiftState
      };
    } catch (error) {
      if (shiftStateRequestRef.current !== requestId) {
        return { ok: false };
      }

      const message = toUserErrorMessage(error, { context: 'panel_dashboard' });
      setShiftState((current) => ({
        ...current,
        isLoading: false,
        error: message
      }));
      return {
        ok: false,
        error,
        message
      };
    }
  }, [currentStoreDateLabel, currentUser?.sessionToken]);

  useEffect(() => {
    loadShiftState({ silent: false }).catch(() => {});

    return undefined;
  }, [currentStoreDateLabel, loadShiftState]);

  async function openShift(shiftType, { openingCash } = {}) {
    if (isSavingShift) {
      return { ok: false, busy: true };
    }

    const normalizedShiftType = String(shiftType || '').trim().toLowerCase();
    if (!['manana', 'tarde', 'noche'].includes(normalizedShiftType)) {
      throw new Error('Turno invalido.');
    }

    setIsSavingShift(true);
    try {
      const result = await openScannerShift(normalizedShiftType, {
        token: currentUser?.sessionToken || '',
        date: currentStoreDateLabel,
        openingCash
      });
      const openedShift = result?.shift || null;
      if (openedShift?.shiftType) {
        setShiftState((current) => {
          const nextShifts = Array.isArray(current.shifts)
            ? current.shifts.map((shift) => (
                shift.shiftType === openedShift.shiftType
                  ? {
                      ...shift,
                      ...openedShift
                    }
                  : shift
              ))
            : [];
          const hasShift = nextShifts.some((shift) => shift.shiftType === openedShift.shiftType);
          return {
            ...current,
            shifts: hasShift ? nextShifts : [...nextShifts, openedShift],
            activeShift: openedShift
          };
        });
      }

      loadShiftState({ silent: true }).catch(() => {});
      return {
        ok: true,
        shift: openedShift
      };
    } catch (error) {
      const message = toUserErrorMessage(error, { context: 'panel_dashboard' });
      setShiftState((current) => ({
        ...current,
        error: message
      }));
      throw new Error(message);
    } finally {
      setIsSavingShift(false);
    }
  }

  async function closeShift(shiftId) {
    const numericShiftId = Number(shiftId);
    if (!Number.isInteger(numericShiftId) || numericShiftId <= 0) {
      throw new Error('Turno invalido.');
    }

    if (isSavingShift) {
      return { ok: false, busy: true };
    }

    setIsSavingShift(true);
    try {
      const result = await closeScannerShift(numericShiftId, {
        token: currentUser?.sessionToken || ''
      });
      await loadShiftState({ silent: true });
      return {
        ok: true,
        shift: result?.shift || null
      };
    } catch (error) {
      const message = toUserErrorMessage(error, { context: 'panel_dashboard' });
      setShiftState((current) => ({
        ...current,
        error: message
      }));
      throw new Error(message);
    } finally {
      setIsSavingShift(false);
    }
  }

  async function resetTodayShifts() {
    if (isSavingShift) {
      return { ok: false, busy: true };
    }

    setIsSavingShift(true);
    try {
      const result = await resetScannerShifts({
        token: currentUser?.sessionToken || '',
        date: currentStoreDateLabel
      });
      await loadShiftState({ silent: true });
      return {
        ok: true,
        result: result?.result || null
      };
    } catch (error) {
      const message = toUserErrorMessage(error, { context: 'panel_dashboard' });
      setShiftState((current) => ({
        ...current,
        error: message
      }));
      throw new Error(message);
    } finally {
      setIsSavingShift(false);
    }
  }

  useEffect(() => {
    if (!currentUser?.sessionToken || !canViewDiagnostics) {
      setDiagnosticEvents([]);
      setDiagnosticEventsError('');
      setIsLoadingDiagnosticEvents(false);
      return undefined;
    }

    loadDiagnosticEvents();
    const intervalId = window.setInterval(() => {
      loadDiagnosticEvents({ silent: true }).catch(() => {});
    }, DIAGNOSTIC_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [canViewDiagnostics, currentUser?.sessionToken, loadDiagnosticEvents]);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout = null;
    let unsubscribe = () => {};

    function connect() {
      if (!isMounted) {
        return;
      }

      unsubscribe = subscribePanelDashboard({
        token: currentUser?.sessionToken || '',
        params: {
          date: currentStoreDateLabel,
          profitRate
        },
        onDashboard: (response) => {
          if (!isMounted) {
            return;
          }
          setDashboard(response?.dashboard || EMPTY_DASHBOARD);
          setDashboardError('');
          loadShiftState({ silent: true }).catch(() => {});
        },
        onLiveScanner: (response) => {
          if (!isMounted) {
            return;
          }
          const nextLiveScanner = response?.liveScanner || null;
          const snapshotKey = nextLiveScanner
            ? `${String(nextLiveScanner.updatedAt || '')}::${String(nextLiveScanner.lastScannedAt || '')}`
            : 'empty';

          if (snapshotKey === lastLiveSnapshotKeyRef.current) {
            return;
          }
          lastLiveSnapshotKeyRef.current = snapshotKey;

          const now = Date.now();
          const lastScannedAt = nextLiveScanner?.lastScannedAt ? Date.parse(nextLiveScanner.lastScannedAt) : NaN;
          const updatedAt = nextLiveScanner?.updatedAt ? Date.parse(nextLiveScanner.updatedAt) : NaN;
          const totalMs = Number.isFinite(lastScannedAt) ? Number((now - lastScannedAt).toFixed(1)) : null;
          const relayMs = Number.isFinite(updatedAt) ? Number((now - updatedAt).toFixed(1)) : null;

          if (totalMs != null) {
            const relayLabel = relayMs != null ? `${relayMs} ms` : '-';
            if (totalMs > PANEL_LIVE_SLOW_MS) {
              console.warn(`[PANEL_LIVE][LENTO] total=${totalMs} ms relay~=${relayLabel} (> ${PANEL_LIVE_SLOW_MS} ms)`);
            } else {
              console.info(`[PANEL_LIVE][OK] total=${totalMs} ms relay~=${relayLabel}`);
            }
          }

          setRemoteLiveScanner(nextLiveScanner);
        },
        onError: (error) => {
          if (!isMounted) {
            return;
          }
          if (Number(error?.status) === 401) {
            setDashboardError('Sesion expirada. Inicia sesion nuevamente.');
            onUnauthorized?.();
            return;
          }
          setDashboardError(toUserErrorMessage(error, { context: 'panel_dashboard' }));
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connect, 2500);
        }
      });
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      unsubscribe();
    };
  }, [currentUser?.sessionToken, currentStoreDateLabel, onUnauthorized, profitRate]);

  const panelMetrics = dashboard.metrics || EMPTY_DASHBOARD.metrics;
  const salesByPaymentMethod = dashboard.salesByPaymentMethod || EMPTY_DASHBOARD.salesByPaymentMethod;
  const effectiveCashTotal = Number(salesByPaymentMethod.efectivo || 0) + Number(panelMetrics.customerAccountPaymentsCashTotal || 0);
  const effectiveCardTotal = Number(salesByPaymentMethod.tarjeta || 0) + Number(panelMetrics.customerAccountPaymentsCardTotal || 0);
  const comparison = useMemo(() => {
    const baseComparison = dashboard.comparison || EMPTY_DASHBOARD.comparison;
    const dashboardDate = String(dashboard?.date || '').trim();

    if (
      currentStoreDateLabel === PANEL_YESTERDAY_BOOTSTRAP_DATE
      && dashboardDate === PANEL_YESTERDAY_BOOTSTRAP_DATE
    ) {
      return {
        ...baseComparison,
        yesterday: PANEL_YESTERDAY_BOOTSTRAP_AMOUNT
      };
    }

    return baseComparison;
  }, [currentStoreDateLabel, dashboard?.comparison, dashboard?.date]);
  const movementItems = Array.isArray(dashboard.movements) ? dashboard.movements : [];
  const rankingItems = Array.isArray(dashboard.ranking) ? dashboard.ranking : [];
  const liveItems = useMemo(() => {
    const sourceItems = Array.isArray(remoteLiveScanner?.items) ? remoteLiveScanner.items : [];
    return sourceItems.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      quantity: Number(item.quantity || 1),
      precio: Number(item.precio_venta || item.precio || 0)
    }));
  }, [remoteLiveScanner?.items]);

  const liveTotal = useMemo(
    () => liveItems.reduce((acc, item) => acc + item.precio * item.quantity, 0),
    [liveItems]
  );

  const liveTimestamp = remoteLiveScanner?.lastScannedAt || remoteLiveScanner?.updatedAt || null;

  const liveTimeLabel = useMemo(() => {
    if (!liveTimestamp) {
      return '--:--:--';
    }

    return new Intl.DateTimeFormat('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: STORE_TIME_ZONE
    }).format(parseDateInput(liveTimestamp));
  }, [liveTimestamp]);

  const comparisonVsYesterday = useMemo(() => {
    if (!comparison.yesterday) {
      return 0;
    }
    return ((comparison.today - comparison.yesterday) / comparison.yesterday) * 100;
  }, [comparison.today, comparison.yesterday]);

  const comparisonVsRecord = useMemo(() => {
    if (!comparison.record) {
      return 0;
    }
    return ((comparison.today - comparison.record) / comparison.record) * 100;
  }, [comparison.today, comparison.record]);

  const comparisonClass = comparisonVsYesterday >= 0 ? 'panel-comparison-positive' : 'panel-comparison-negative';
  const hasLiveItems = liveItems.length > 0;
  const hasMovementItems = movementItems.length > 0;
  const hasRankingItems = rankingItems.length > 0;
  const visibleMovementItems = movementItems.slice(0, visibleMovementsCount);
  const visibleRankingItems = rankingItems.slice(0, visibleRankingCount);
  const canExpandMovements = movementItems.length > 3;
  const canExpandRanking = rankingItems.length > 5;
  const movementExpandLabel = visibleMovementsCount >= movementItems.length
    ? 'Ver menos'
    : (visibleMovementsCount <= 3 ? 'Ver 3 mas' : 'Ver todos');
  const rankingExpandLabel = visibleRankingCount >= rankingItems.length
    ? 'Ver menos'
    : (visibleRankingCount <= 5 ? 'Ver 5 mas' : 'Ver todos');
  const operatorName = String(remoteLiveScanner?.operator?.display_name || '').trim() || 'Operario';
  const rankingDateLabel = useMemo(() => {
    const rawDate = String(dashboard?.date || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const [year, month, day] = rawDate.split('-').map((value) => Number(value));
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }

    return new Intl.DateTimeFormat('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: STORE_TIME_ZONE
    }).format(new Date());
  }, [dashboard?.date]);
  const todayLabel = getTodayLabel();

  const metrics = [
    { title: 'Caja inicial', value: moneyNoDecimals(panelMetrics.initialCash), hint: 'Monto de apertura del dia.' },
    { title: 'Ventas del dia', value: moneyNoDecimals(panelMetrics.salesToday), hint: 'Confirmadas con el boton Cobrar.' },
    { title: 'Ganancia estimada', value: moneyNoDecimals(panelMetrics.profitToday), hint: `${Number((panelMetrics.profitRate ?? profitRate) || 0) * 100}% de ventas del dia. No descuenta pagos.` },
    { title: 'Monto actual', value: moneyNoDecimals(panelMetrics.currentAmount), hint: 'Plata fisica en caja: caja inicial + efectivo + cobros de cuenta en efectivo - pagos.' },
    { title: 'Pagos realizados', value: moneyNoDecimals(panelMetrics.paymentsTotal), hint: 'Suma de pagos registrados' }
  ];
  const salePaymentMethodMetrics = [
    { title: 'Efectivo', value: moneyNoDecimals(effectiveCashTotal), hint: 'Todo lo que ingreso en efectivo: ventas nuevas + cobros de cuenta en efectivo.' },
    { title: 'En tarjeta', value: moneyNoDecimals(effectiveCardTotal), hint: 'Ventas y cobros de cuenta que se efectivizaron con tarjeta.' },
    { title: 'En cuenta', value: moneyNoDecimals(salesByPaymentMethod.cuenta), hint: 'Ventas del dia que quedaron fiadas.' }
  ];

  async function saveInitialCash(rawAmount) {
    const parsedAmount = Number(String(rawAmount || '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      const error = new Error('Ingresa una caja inicial valida mayor o igual a 0.');
      error.code = 'INVALID_INITIAL_CASH';
      throw error;
    }

    if (isSavingInitialCash) {
      return {
        ok: false,
        busy: true
      };
    }

    setIsSavingInitialCash(true);
    try {
      const result = await updatePanelInitialCash({
        date: currentStoreDateLabel,
        initialCash: Number(parsedAmount.toFixed(2))
      }, {
        token: currentUser?.sessionToken || ''
      });

      return {
        ok: true,
        settings: result?.settings || null
      };
    } finally {
      setIsSavingInitialCash(false);
    }
  }

  function updateProfitRate(rawPercent) {
    const parsedPercent = Number(String(rawPercent || '').replace(',', '.'));
    if (!Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent > 100) {
      const error = new Error('Ingresa un porcentaje valido entre 0 y 100.');
      error.code = 'INVALID_PROFIT_RATE';
      throw error;
    }

    setProfitRate(Number((parsedPercent / 100).toFixed(4)));
    return {
      ok: true
    };
  }

  function handleRegisterPayment(event, options = {}) {
    event.preventDefault();

    if (isRegisteringPayment) {
      return { ok: false, busy: true };
    }

    const parsedAmount = parsePositiveAmount(paymentAmount);
    const trimmedDescription = String(paymentDescription || '').trim();

    if (parsedAmount === null) {
      setPaymentError('Ingresa un monto valido mayor a 0.');
      return;
    }

    if (!trimmedDescription) {
      setPaymentError('La descripcion es obligatoria.');
      return { ok: false };
    }

    setPaymentAmount('');
    setPaymentDescription('');
    setPaymentError('');
    setIsRegisteringPayment(true);

    registerPanelPayment({
      externalId: `payment-${Date.now()}`,
      userId: currentUser?.id || null,
      amount: parsedAmount,
      description: trimmedDescription
    }, {
      token: currentUser?.sessionToken || ''
    })
      .then((result) => {
        const elapsedMs = Number(result?._meta?.elapsedMs || 0);
        const serverElapsedMs = Number(result?.meta?.elapsedMs || 0);
        const serverDbElapsedMs = Number(result?.meta?.dbElapsedMs || 0);
        const serverAppElapsedMs = Number(result?.meta?.appElapsedMs || 0);
        options?.onSuccess?.({
          elapsedMs,
          serverElapsedMs,
          serverDbElapsedMs,
          serverAppElapsedMs
        });
      })
      .catch((error) => {
        const message = toUserErrorMessage(error, { context: 'panel_payment' });
        setPaymentError(message);
        options?.onError?.(new Error(message));
      })
      .finally(() => {
        setIsRegisteringPayment(false);
      });

    return { ok: true };
  }

  async function refreshDiagnosticEvents() {
    return loadDiagnosticEvents();
  }

  function toggleMovementDetail(movementId) {
    setExpandedMovementId((current) => (current === movementId ? null : movementId));
  }

  function expandMovements() {
    if (visibleMovementsCount >= movementItems.length) {
      setVisibleMovementsCount(3);
      setExpandedMovementId(null);
      return;
    }
    if (visibleMovementsCount <= 3) {
      setVisibleMovementsCount(Math.min(6, movementItems.length));
      return;
    }
    setVisibleMovementsCount(movementItems.length);
  }

  function expandRanking() {
    if (visibleRankingCount >= rankingItems.length) {
      setVisibleRankingCount(5);
      return;
    }
    if (visibleRankingCount <= 5) {
      setVisibleRankingCount(Math.min(10, rankingItems.length));
      return;
    }
    setVisibleRankingCount(rankingItems.length);
  }

  return {
    dashboardError,
    isComparisonOpen,
    setIsComparisonOpen,
    metrics,
    salePaymentMethodMetrics,
    comparison,
    comparisonClass,
    comparisonVsYesterday,
    comparisonVsRecord,
    hasLiveItems,
    hasMovementItems,
    hasRankingItems,
    visibleMovementItems,
    visibleRankingItems,
    canExpandMovements,
    canExpandRanking,
    movementExpandLabel,
    rankingExpandLabel,
    expandedMovementId,
    rankingDateLabel,
    operatorName,
    todayLabel,
    initialCashAmount: Number(panelMetrics.initialCash || 0),
    liveEditor: remoteLiveScanner?.liveEditor || null,
    liveItems,
    liveTotal,
    liveTimeLabel,
    paymentAmount,
    paymentDescription,
    paymentError,
    isRegisteringPayment,
    isSavingInitialCash,
    shiftState,
    isSavingShift,
    diagnosticEvents,
    diagnosticFilter,
    diagnosticEventsError,
    isLoadingDiagnosticEvents,
    canViewDiagnostics,
    profitRatePercent: Number(((panelMetrics.profitRate ?? profitRate) || 0) * 100),
    currentStoreDateLabel,
    percent,
    handleRegisterPayment,
    saveInitialCash,
    updateProfitRate,
    refreshDiagnosticEvents,
    loadShiftState,
    openShift,
    closeShift,
    resetTodayShifts,
    setDiagnosticFilter,
    toggleMovementDetail,
    expandMovements,
    expandRanking,
    setPaymentAmount,
    setPaymentDescription
  };
}

