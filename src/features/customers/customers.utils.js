export function parseMoneyValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = Number(String(value || '').trim().replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

export function formatMoney(value) {
  return `$${parseMoneyValue(value).toFixed(2)}`;
}

export function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-UY', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(parsed);
}

export function formatSaleItems(items = []) {
  return items
    .filter((item) => String(item?.name || '').trim())
    .map((item) => {
      const itemName = String(item.name || '').trim();
      const quantity = Number(item.quantity || 0);
      const lineTotal = formatMoney(item.lineTotal || 0);
      const unitPrice = Number(item.unitPrice || 0) > 0 ? ` x ${formatMoney(item.unitPrice)}` : '';
      return `${itemName}${quantity > 0 ? ` x${quantity}` : ''}${unitPrice} - ${lineTotal}`;
    });
}

export function parsePositiveAmount(value) {
  const normalized = Number(String(value || '').replace(',', '.'));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

export function isRouteUnavailableError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').trim().toLowerCase();
  return status === 404 || message.includes('route not found') || message.includes('not found');
}

function sortMovementsDesc(left, right) {
  const leftTime = new Date(left?.createdAt || 0).getTime();
  const rightTime = new Date(right?.createdAt || 0).getTime();
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return Number(right?.id || 0) - Number(left?.id || 0);
}

export function getActiveCustomerHistory({ accountSales = [], accountPayments = [], debtTotal = 0 }) {
  const normalizedDebt = parseMoneyValue(debtTotal);
  if (normalizedDebt <= 0) {
    return { sales: [], payments: [] };
  }

  const movements = [
    ...accountSales.map((sale) => ({ ...sale, movementType: 'sale', amount: Number(sale?.totalAmount || 0) })),
    ...accountPayments.map((payment) => ({ ...payment, movementType: 'payment', amount: Number(payment?.amount || 0) }))
  ].sort(sortMovementsDesc);

  let debtCursor = normalizedDebt;
  const activeSaleIds = new Set();
  const activePaymentIds = new Set();

  for (const movement of movements) {
    if (movement.movementType === 'payment') {
      activePaymentIds.add(Number(movement.id || 0));
      debtCursor += Number(movement.amount || 0);
      continue;
    }

    activeSaleIds.add(Number(movement.id || 0));
    debtCursor -= Number(movement.amount || 0);
    if (debtCursor <= 0) {
      break;
    }
  }

  return {
    sales: accountSales.filter((sale) => activeSaleIds.has(Number(sale.id || 0))),
    payments: accountPayments.filter((payment) => activePaymentIds.has(Number(payment.id || 0)))
  };
}

export function buildCustomerHistoryTicketPayload({ customer, accountSales = [], currentUser }) {
  const sortedSales = accountSales
    .slice()
    .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());

  const ticketItems = sortedSales.flatMap((sale) => (
    Array.isArray(sale?.items)
      ? sale.items
        .filter((item) => String(item?.name || '').trim())
        .map((item) => ({
          nombre: String(item.name || '').trim(),
          quantity: Number(item.quantity || 0) || 1,
          precio_venta: Number(item.unitPrice || 0)
        }))
      : []
  ));

  return {
    hasSales: sortedSales.length > 0 && ticketItems.length > 0,
    salesCount: sortedSales.length,
    ticket: {
      storeName: 'Super Nova',
      externalId: `CTA-${customer?.id || '-'}`,
      chargedAtIso: sortedSales.at(-1)?.createdAt || new Date().toISOString(),
      operatorName: currentUser?.name || currentUser?.username || 'Operario',
      items: ticketItems,
      total: sortedSales.reduce((sum, sale) => sum + Number(sale?.totalAmount || 0), 0)
    }
  };
}
