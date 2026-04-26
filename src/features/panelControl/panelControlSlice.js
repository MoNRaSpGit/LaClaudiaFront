import { createSelector, createSlice } from '@reduxjs/toolkit';

const initialState = {
  initialCash: 1000,
  profitRate: 0.2,
  yesterdaySales: 0,
  bestDaySales: 0,
  sales: [],
  payments: []
};

function sumSaleTotals(sales = []) {
  return sales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
}

function sumPaymentTotals(payments = []) {
  return payments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
}

const panelControlSlice = createSlice({
  name: 'panelControl',
  initialState,
  reducers: {
    confirmSale(state, action) {
      const sale = action.payload || {};
      if (!Array.isArray(sale.items) || !sale.items.length) {
        return;
      }

      state.sales.push({
        id: sale.id,
        total: Number(sale.total || 0),
        items: sale.items,
        createdAt: sale.createdAt
      });

      const salesToday = sumSaleTotals(state.sales);
      if (salesToday > state.bestDaySales) {
        state.bestDaySales = salesToday;
      }
    },
    registerPayment(state, action) {
      const payment = action.payload || {};
      const amount = Number(payment.amount || 0);
      if (amount <= 0) {
        return;
      }

      state.payments.push({
        id: payment.id,
        amount,
        description: payment.description || '',
        createdAt: payment.createdAt
      });
    },
    setInitialCash(state, action) {
      const nextAmount = Number(action.payload);
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        return;
      }
      state.initialCash = nextAmount;
    }
  }
});

const selectPanelState = (state) => state.panelControl;

export const selectPanelMetrics = createSelector([selectPanelState], (panelState) => {
  const salesToday = sumSaleTotals(panelState.sales);
  const paymentsTotal = sumPaymentTotals(panelState.payments);
  const profitToday = salesToday * Number(panelState.profitRate || 0);
  const currentAmount = Number(panelState.initialCash || 0) + salesToday - paymentsTotal;

  return {
    initialCash: Number(panelState.initialCash || 0),
    salesToday,
    profitToday,
    currentAmount,
    paymentsTotal
  };
});

export const selectPanelComparison = createSelector(
  [selectPanelState, selectPanelMetrics],
  (panelState, metrics) => {
    const today = metrics.salesToday;
    const yesterday = Number(panelState.yesterdaySales || 0);
    const record = Math.max(Number(panelState.bestDaySales || 0), today);

    return {
      today,
      yesterday,
      record
    };
  }
);

export const selectPanelMovements = createSelector([selectPanelState], (panelState) => {
  const salesMovements = panelState.sales.map((sale) => ({
    id: sale.id,
    type: 'Venta',
    amount: Number(sale.total || 0),
    createdAt: sale.createdAt,
    detail: {
      kind: 'sale',
      operator: 'Operario',
      createdAt: sale.createdAt,
      items: sale.items.map((item) => {
        const qty = Number(item.quantity || 1);
        const unitPrice = Number(item.precio_venta || 0);
        return {
          id: item.id,
          name: item.nombre,
          quantity: qty,
          lineTotal: qty * unitPrice
        };
      })
    }
  }));

  const paymentMovements = panelState.payments.map((payment) => ({
    id: payment.id,
    type: 'Pago',
    amount: Number(payment.amount || 0) * -1,
    createdAt: payment.createdAt,
    detail: {
      kind: 'payment',
      description: payment.description ? payment.description : 'Pago registrado sin descripcion.'
    }
  }));

  return [...salesMovements, ...paymentMovements]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
});

export const selectPanelRanking = createSelector([selectPanelState], (panelState) => {
  const map = new Map();

  panelState.sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const key = item.productId ? `product:${item.productId}` : `manual:${item.nombre}`;
      const current = map.get(key) || { name: item.nombre, qty: 0 };
      current.qty += Number(item.quantity || 1);
      map.set(key, current);
    });
  });

  return Array.from(map.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
});

export const { confirmSale, registerPayment, setInitialCash } = panelControlSlice.actions;
export default panelControlSlice.reducer;
