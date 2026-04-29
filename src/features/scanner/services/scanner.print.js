function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
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

function buildReceiptHtml({
  storeName = 'Super Nova',
  externalId,
  operatorName,
  chargedAtIso,
  items = [],
  total = 0
}) {
  const rows = items
    .map((item) => {
      const name = escapeHtml(item.nombre || 'Producto');
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.precio_venta || 0);
      const lineTotal = quantity * unitPrice;

      return `
        <div class="line-item">
          <div class="line-name">${name}</div>
          <div class="line-cols">
            <span class="col qty">${quantity}</span>
            <span class="col unit">$${money(unitPrice)}</span>
            <span class="col sub">$${money(lineTotal)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ticket ${escapeHtml(externalId || '')}</title>
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
    .divider {
      border-top: 1px dashed #000;
      margin: 2mm 0;
    }
    .head-cols,
    .line-cols,
    .total {
      display: grid;
      grid-template-columns: 16% 36% 48%;
      align-items: baseline;
      column-gap: 2mm;
    }
    .head-cols {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 1mm;
    }
    .line-item { margin-bottom: 1.5mm; }
    .line-name {
      font-weight: 700;
      margin-bottom: 0.5mm;
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .col.qty { text-align: left; }
    .col.unit { text-align: right; }
    .col.sub { text-align: right; }
    .total {
      grid-template-columns: 52% 48%;
      font-size: 16px;
      font-weight: 700;
    }
    .total-label { text-align: left; }
    .total-value { text-align: right; }
    .footer {
      margin-top: 3mm;
      text-align: center;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="center title">${escapeHtml(storeName)}</div>
  <div class="center meta">Ticket: ${escapeHtml(externalId || '-')}</div>
  <div class="center meta">Fecha: ${escapeHtml(formatWhen(chargedAtIso))}</div>
  <div class="center meta">Operario: ${escapeHtml(operatorName || 'Operario')}</div>

  <div class="divider"></div>

  <div class="head-cols">
    <span>Cant</span>
    <span style="text-align:right;">P.Unit</span>
    <span style="text-align:right;">Subtotal</span>
  </div>

  ${rows}

  <div class="divider"></div>

  <div class="total">
    <span class="total-label">TOTAL</span>
    <span class="total-value">$${money(total)}</span>
  </div>

  <div class="divider"></div>
  <div class="footer">Gracias por su compra</div>
</body>
</html>`;
}

export async function printSaleTicket(ticket) {
  if (typeof window === 'undefined') {
    throw new Error('Impresion no disponible fuera del navegador.');
  }

  const printWindow = window.open('', '_blank', 'width=420,height=700');
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana de impresion. Revisa bloqueo de popups.');
  }

  const html = buildReceiptHtml(ticket || {});
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
