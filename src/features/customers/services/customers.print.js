function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function buildSaleItemRows(items = []) {
  return items
    .filter((item) => String(item?.name || '').trim())
    .map((item) => {
      const name = escapeHtml(String(item.name || '').trim());
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const lineTotal = money(item.lineTotal || 0);
      const quantityLabel = quantity > 0 ? ` x${quantity}` : '';
      const unitPriceLabel = unitPrice > 0 ? ` x $${money(unitPrice)}` : '';
      return `<div class="entry-item">${name}${quantityLabel}${unitPriceLabel} - $${lineTotal}</div>`;
    })
    .join('');
}

function buildSalesRows(items = []) {
  if (!items.length) {
    return '<p class="empty">Sin ventas en cuenta registradas.</p>';
  }

  return items
    .map((item) => `
      <div class="entry">
        <div class="entry-main">
          <strong>$${money(item.totalAmount)}</strong>
          <span>${Number(item.itemsCount || 0)} item(s)</span>
        </div>
        <div class="entry-meta">${escapeHtml(formatWhen(item.createdAt))}</div>
        ${buildSaleItemRows(item.items)}
      </div>
    `)
    .join('');
}

function buildPaymentsRows(items = []) {
  if (!items.length) {
    return '<p class="empty">Sin pagos registrados.</p>';
  }

  return items
    .map((item) => {
      const paymentMethod = String(item.paymentMethod || '').trim().toLowerCase() === 'tarjeta' ? 'Tarjeta' : 'Efectivo';
      const notes = String(item.notes || '').trim();

      return `
        <div class="entry">
          <div class="entry-main">
            <strong>$${money(item.amount)}</strong>
            <span>${escapeHtml(paymentMethod)}${notes ? ` - ${escapeHtml(notes)}` : ''}</span>
          </div>
          <div class="entry-meta">${escapeHtml(formatWhen(item.createdAt))}</div>
        </div>
      `;
    })
    .join('');
}

function buildCustomerStatementHtml({
  storeName = 'Super Nova',
  customerName = 'Cliente',
  printedAtIso,
  operatorName = 'Operario',
  debtTotal = 0,
  accountSales = [],
  accountPayments = []
}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Estado de cuenta ${escapeHtml(customerName)}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      width: 74mm;
      font-family: Consolas, "Lucida Console", "Courier New", monospace;
      color: #111;
      font-size: 11px;
      line-height: 1.25;
      padding-bottom: 5mm;
      margin: 0 auto;
    }
    .center { text-align: center; }
    .title { font-size: 15px; font-weight: 700; margin-bottom: 1mm; }
    .meta { font-size: 10px; margin-bottom: 1mm; }
    .divider { border-top: 1px dashed #000; margin: 2mm 0; }
    .section-title { font-size: 11px; font-weight: 700; margin-bottom: 1.5mm; }
    .balance {
      display: flex;
      justify-content: space-between;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 2mm;
    }
    .entry {
      margin-bottom: 2mm;
      padding-bottom: 1.5mm;
      border-bottom: 1px dotted #bbb;
    }
    .entry:last-child { border-bottom: none; }
    .entry-main {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      align-items: baseline;
    }
    .entry-main span {
      text-align: right;
      font-size: 10px;
    }
    .entry-meta {
      font-size: 10px;
      color: #444;
      margin-top: 0.5mm;
    }
    .entry-item {
      margin-top: 0.6mm;
      padding-left: 2mm;
      font-size: 10px;
      color: #222;
    }
    .empty {
      margin: 0 0 2mm;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="center title">${escapeHtml(storeName)}</div>
  <div class="center meta">Estado de cuenta</div>
  <div class="center meta">Cliente: ${escapeHtml(customerName)}</div>
  <div class="center meta">Fecha: ${escapeHtml(formatWhen(printedAtIso))}</div>
  <div class="center meta">Operario: ${escapeHtml(operatorName)}</div>

  <div class="divider"></div>

  <div class="balance">
    <span>Saldo</span>
    <span>$${money(debtTotal)}</span>
  </div>

  <div class="divider"></div>

  <div class="section-title">Ultimas ventas en cuenta</div>
  ${buildSalesRows(accountSales)}

  <div class="divider"></div>

  <div class="section-title">Ultimos pagos</div>
  ${buildPaymentsRows(accountPayments)}
</body>
</html>`;
}

export async function printCustomerStatement(statement) {
  if (typeof window === 'undefined') {
    throw new Error('Impresion no disponible fuera del navegador.');
  }

  const printWindow = window.open('', '_blank', 'width=420,height=760');
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana de impresion. Revisa bloqueo de popups.');
  }

  const html = buildCustomerStatementHtml(statement || {});
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  await new Promise((resolve) => {
    const onLoad = () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
        resolve();
      }, 300);
    };

    if (printWindow.document.readyState === 'complete') {
      onLoad();
      return;
    }

    printWindow.addEventListener('load', onLoad, { once: true });
  });
}
