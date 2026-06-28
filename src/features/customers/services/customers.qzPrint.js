import qz from 'qz-tray';

const TICKET_WIDTH = 42;
const FALLBACK_PREFERRED_PRINTER = 'ImpRamon';
let cachedPrinterName = FALLBACK_PREFERRED_PRINTER;

function money(value) {
  return Number(value || 0).toFixed(2);
}

function formatWhen(isoDate) {
  const date = isoDate ? new Date(isoDate) : new Date();
  return date.toLocaleString('es-UY', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function divider() {
  return '-'.repeat(TICKET_WIDTH);
}

function padLine(left = '', rightValue = '', width = TICKET_WIDTH) {
  const leftText = String(left || '');
  const rightText = String(rightValue || '');
  const free = Math.max(1, width - rightText.length);
  return `${leftText.slice(0, free)}${' '.repeat(Math.max(1, width - leftText.slice(0, free).length - rightText.length))}${rightText}`;
}

function pickPrinterName(printers = []) {
  const list = Array.isArray(printers) ? printers : [];
  const physical = list.filter((name) => !/pdf|xps|onenote|fax|microsoft print to pdf/i.test(String(name || '')));
  if (!physical.length) {
    return '';
  }

  const preferred = physical.find((name) => /xprinter|xp-|pos|thermal|receipt/i.test(String(name || '')));
  return preferred || physical[0];
}

async function ensureQzConnected() {
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }
}

function appendWrappedLine(lines, text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return;
  }

  const chunks = normalized.match(new RegExp(`.{1,${TICKET_WIDTH}}`, 'g')) || [normalized];
  chunks.forEach((chunk) => {
    lines.push(`${chunk}\n`);
  });
}

function formatSaleItemLine(item = {}) {
  const name = String(item.name || '').trim();
  if (!name) {
    return '';
  }

  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const lineTotal = money(item.lineTotal || 0);
  const quantityLabel = quantity > 0 ? ` x${quantity}` : '';
  const unitPriceLabel = unitPrice > 0 ? ` x $${money(unitPrice)}` : '';
  return `${name}${quantityLabel}${unitPriceLabel} - $${lineTotal}`;
}

function buildRawCustomerStatement(statement = {}) {
  const sales = Array.isArray(statement.accountSales) ? statement.accountSales : [];
  const payments = Array.isArray(statement.accountPayments) ? statement.accountPayments : [];
  const lines = [];

  lines.push('\x1B\x40');
  lines.push('\x1B\x61\x01');
  lines.push(`${String(statement.storeName || 'Super Nova')}\n`);
  lines.push('Estado de cuenta\n');
  lines.push(`Cliente: ${String(statement.customerName || 'Cliente')}\n`);
  lines.push(`Fecha: ${formatWhen(statement.printedAtIso)}\n`);
  lines.push(`Operario: ${String(statement.operatorName || 'Operario')}\n`);
  lines.push('\x1B\x61\x00');
  lines.push(`${divider()}\n`);
  lines.push(`${padLine('SALDO', `$${money(statement.debtTotal)}`)}\n`);
  lines.push(`${divider()}\n`);
  lines.push('ULTIMAS VENTAS EN CUENTA\n');

  if (!sales.length) {
    lines.push('Sin ventas en cuenta\n');
  } else {
    sales.forEach((sale) => {
      lines.push(`${padLine(formatWhen(sale.createdAt), `$${money(sale.totalAmount)}`)}\n`);
      lines.push(`${padLine(`${Number(sale.itemsCount || 0)} item(s)`, '')}\n`);
      (Array.isArray(sale.items) ? sale.items : []).forEach((item) => {
        appendWrappedLine(lines, formatSaleItemLine(item));
      });
    });
  }

  lines.push(`${divider()}\n`);
  lines.push('ULTIMOS PAGOS\n');

  if (!payments.length) {
    lines.push('Sin pagos registrados\n');
  } else {
    payments.forEach((payment) => {
      const paymentMethod = String(payment.paymentMethod || '').trim().toLowerCase() === 'tarjeta' ? 'Tarjeta' : 'Efectivo';
      lines.push(`${padLine(formatWhen(payment.createdAt), `$${money(payment.amount)}`)}\n`);
      appendWrappedLine(lines, `${paymentMethod}${payment.notes ? ` - ${payment.notes}` : ''}`);
    });
  }

  lines.push('\n\n\n');
  lines.push('\x1D\x56\x41\x00');

  return lines;
}

export async function printCustomerStatementByQz(statement) {
  await ensureQzConnected();
  const data = buildRawCustomerStatement(statement);

  const attemptPrinter = async (printerName) => {
    const config = qz.configs.create(printerName, { encoding: 'CP437' });
    await qz.print(config, data);
    cachedPrinterName = printerName;
    return { printerName };
  };

  if (cachedPrinterName) {
    try {
      return await attemptPrinter(cachedPrinterName);
    } catch {
      // Si falla, intentar descubrimiento una sola vez.
    }
  }

  const printers = await qz.printers.find();
  const printerName = pickPrinterName(printers);
  if (!printerName) {
    const detected = Array.isArray(printers) && printers.length ? printers.join(', ') : 'ninguna';
    throw new Error(`QZ no encontro una impresora termica (Xprinter/POS). Detectadas: ${detected}`);
  }

  return attemptPrinter(printerName);
}
