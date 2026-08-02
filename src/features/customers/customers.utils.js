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

/**
 * Junta los items de un grupo de ventas a cuenta (agrupados por nombre de
 * producto, sumando cantidad y subtotal) para armar un comprobante. Se usa
 * para el "Imprimir comprobante" de deuda pendiente: el mismo formato que el
 * backend arma para el ticket de cierre de pago, pero calculado del lado del
 * cliente a partir de las ventas ya marcadas como pendientes (`isSettled:
 * false`) que manda el backend en el detalle del cliente.
 */
export function aggregateSaleItems(sales = []) {
  const itemsByName = new Map();

  sales.forEach((sale) => {
    (Array.isArray(sale?.items) ? sale.items : []).forEach((item) => {
      const name = String(item?.name || '').trim();
      if (!name) {
        return;
      }
      const current = itemsByName.get(name) || { name, quantity: 0, lineTotal: 0 };
      current.quantity += Number(item.quantity || 0);
      current.lineTotal += Number(item.lineTotal || 0);
      itemsByName.set(name, current);
    });
  });

  return Array.from(itemsByName.values());
}

/**
 * Arma el comprobante de "cierre de cuenta" a partir del detalle de items
 * cubiertos que devuelve el backend en la respuesta del pago (calculado en
 * la misma transaccion que registra el pago, con la deuda real al momento
 * del cobro). No usa el estado local de React: ese puede estar desactualizado
 * si se cargo otra venta a la cuenta mientras la ficha del cliente estaba
 * abierta, lo que antes generaba tickets con montos y fechas viejas.
 */
export function buildCustomerHistoryTicketPayload({ customer, coveredItems = [], currentUser, ticketKind = 'payment' }) {
  const ticketItems = coveredItems
    .filter((item) => String(item?.name || '').trim() && Number(item?.quantity || 0) > 0)
    .map((item) => {
      const quantity = Number(item.quantity || 0) || 1;
      const lineTotal = Number(item.lineTotal || 0);
      return {
        nombre: String(item.name || '').trim(),
        quantity,
        precio_venta: quantity > 0 ? lineTotal / quantity : lineTotal
      };
    });

  // Prefijo distinto segun el tipo de comprobante: "EST" es una consulta de
  // deuda pendiente (no mueve nada), "CTA" es un recibo de pago real. Asi se
  // pueden distinguir a simple vista si alguna vez se imprimen los dos.
  const prefix = ticketKind === 'statement' ? 'EST' : 'CTA';

  return {
    hasSales: ticketItems.length > 0,
    ticket: {
      storeName: 'Super Nova',
      externalId: `${prefix}-${customer?.id || '-'}`,
      chargedAtIso: new Date().toISOString(),
      operatorName: currentUser?.name || currentUser?.username || 'Operario',
      items: ticketItems,
      total: ticketItems.reduce((sum, item) => sum + item.quantity * item.precio_venta, 0)
    }
  };
}
