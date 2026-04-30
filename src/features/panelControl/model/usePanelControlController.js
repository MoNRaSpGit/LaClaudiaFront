import { useEffect, useMemo, useRef, useState } from 'react';
import { parsePositiveAmount } from '../../../shared/lib/number';
import { toUserErrorMessage } from '../../../shared/lib/userErrorMessages';
import { registerPanelPayment, subscribePanelDashboard, updatePanelInitialCash } from '../services/panelControl.api';
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
    profitRate: 0.4
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

export function usePanelControlController({ currentUser, onUnauthorized }) {
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
  const lastLiveSnapshotKeyRef = useRef('');

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
  const canExpandMovements = movementItems.length > visibleMovementsCount;
  const canExpandRanking = rankingItems.length > visibleRankingCount;
  const movementExpandLabel = visibleMovementsCount <= 3 ? 'Ver 3 mas' : 'Ver todos';
  const rankingExpandLabel = visibleRankingCount <= 5 ? 'Ver 5 mas' : 'Ver todos';
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
    { title: 'Ganancia diaria', value: moneyNoDecimals(panelMetrics.profitToday), hint: `${Number((panelMetrics.profitRate ?? profitRate) || 0) * 100}% de ventas del dia` },
    { title: 'Monto actual', value: moneyNoDecimals(panelMetrics.currentAmount), hint: 'Caja diaria + ventas - pagos' },
    { title: 'Pagos realizados', value: moneyNoDecimals(panelMetrics.paymentsTotal), hint: 'Suma de pagos registrados' }
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

  function toggleMovementDetail(movementId) {
    setExpandedMovementId((current) => (current === movementId ? null : movementId));
  }

  function expandMovements() {
    if (visibleMovementsCount <= 3) {
      setVisibleMovementsCount(Math.min(6, movementItems.length));
      return;
    }
    setVisibleMovementsCount(movementItems.length);
  }

  function expandRanking() {
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
    profitRatePercent: Number(((panelMetrics.profitRate ?? profitRate) || 0) * 100),
    percent,
    handleRegisterPayment,
    saveInitialCash,
    updateProfitRate,
    toggleMovementDetail,
    expandMovements,
    expandRanking,
    setPaymentAmount,
    setPaymentDescription
  };
}








