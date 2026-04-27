import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { parsePositiveAmount } from '../../../shared/lib/number';
import { registerPanelPayment, subscribePanelDashboard } from '../services/panelControl.api';
import { money, parseDateInput, percent, STORE_TIME_ZONE, todayLabel } from './panelControl.formatters';

const EMPTY_DASHBOARD = {
  metrics: {
    initialCash: 1000,
    salesToday: 0,
    profitToday: 0,
    currentAmount: 1000,
    paymentsTotal: 0,
    profitRate: 0.2
  },
  comparison: {
    today: 0,
    yesterday: 0,
    record: 0
  },
  movements: [],
  ranking: []
};

export function usePanelControlController({ currentUser }) {
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

  const liveCartItems = useSelector((state) => state.scanner.cartItems);
  const liveLastScannedAt = useSelector((state) => state.scanner.lastScannedAt);
  const liveEditorState = useSelector((state) => state.scanner.liveEditor);

  const liveEditor = liveEditorState || null;

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
        params: {},
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
          setRemoteLiveScanner(response?.liveScanner || null);
        },
        onError: (error) => {
          if (!isMounted) {
            return;
          }
          setDashboardError(error?.message || 'No se pudo cargar dashboard en tiempo real');
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
  }, [currentUser?.sessionToken]);

  const panelMetrics = dashboard.metrics || EMPTY_DASHBOARD.metrics;
  const comparison = dashboard.comparison || EMPTY_DASHBOARD.comparison;
  const movementItems = Array.isArray(dashboard.movements) ? dashboard.movements : [];
  const rankingItems = Array.isArray(dashboard.ranking) ? dashboard.ranking : [];
  const remoteItems = Array.isArray(remoteLiveScanner?.items) ? remoteLiveScanner.items : [];
  const hasRemoteLiveSource = remoteLiveScanner !== null;

  const liveItems = useMemo(() => {
    const sourceItems = hasRemoteLiveSource ? remoteItems : liveCartItems;
    return sourceItems.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      quantity: Number(item.quantity || 1),
      precio: Number(item.precio_venta || item.precio || 0)
    }));
  }, [hasRemoteLiveSource, liveCartItems, remoteItems]);

  const liveTotal = useMemo(
    () => liveItems.reduce((acc, item) => acc + item.precio * item.quantity, 0),
    [liveItems]
  );

  const liveTimestamp = hasRemoteLiveSource
    ? (remoteLiveScanner?.lastScannedAt || remoteLiveScanner?.updatedAt || null)
    : liveLastScannedAt;

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
  const movementExpandLabel = visibleMovementsCount <= 3 ? 'Ver 3 más' : 'Ver todos';
  const rankingExpandLabel = visibleRankingCount <= 5 ? 'Ver 5 más' : 'Ver todos';
  const operatorName = String(remoteLiveScanner?.operator?.display_name || '').trim() || currentUser?.name || 'Admin';
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

  const metrics = [
    { title: 'Caja inicial', value: money(panelMetrics.initialCash), hint: 'Monto de apertura del día.' },
    { title: 'Ventas del día', value: money(panelMetrics.salesToday), hint: 'Confirmadas con el botón Cobrar.' },
    { title: 'Ganancia diaria', value: money(panelMetrics.profitToday), hint: `${Number(panelMetrics.profitRate || 0) * 100}% de ventas del día` },
    { title: 'Monto actual', value: money(panelMetrics.currentAmount), hint: 'Caja diaria + ventas - pagos' },
    { title: 'Pagos realizados', value: money(panelMetrics.paymentsTotal), hint: 'Suma de pagos registrados' }
  ];

  async function handleRegisterPayment(event) {
    event.preventDefault();

    const parsedAmount = parsePositiveAmount(paymentAmount);
    const trimmedDescription = String(paymentDescription || '').trim();

    if (parsedAmount === null) {
      setPaymentError('Ingresa un monto válido mayor a 0.');
      return;
    }

    try {
      await registerPanelPayment({
        externalId: `payment-${Date.now()}`,
        userId: currentUser?.id || null,
        amount: parsedAmount,
        description: trimmedDescription
      }, {
        token: currentUser?.sessionToken || ''
      });
      setPaymentAmount('');
      setPaymentDescription('');
      setPaymentError('');
    } catch (error) {
      setPaymentError(error.message || 'No se pudo registrar el pago.');
    }
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
    liveEditor: hasRemoteLiveSource ? (remoteLiveScanner?.liveEditor || null) : liveEditor,
    liveItems,
    liveTotal,
    liveTimeLabel,
    paymentAmount,
    paymentDescription,
    paymentError,
    percent,
    handleRegisterPayment,
    toggleMovementDetail,
    expandMovements,
    expandRanking,
    setPaymentAmount,
    setPaymentDescription
  };
}
