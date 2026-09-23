import { expect, test } from '@playwright/test';

function buildOpenShift() {
  const nowIso = new Date().toISOString();
  return {
    id: 1,
    businessDate: '2026-09-23',
    shiftType: 'manana',
    shiftLabel: 'Manana',
    status: 'open',
    isOpen: true,
    openingCash: 1000,
    shiftOpeningCash: 1000,
    salesTotal: 0,
    salesCount: 0,
    cashSalesTotal: 0,
    cashCustomerAccountPaymentsTotal: 0,
    cashDepositsTotal: 0,
    cashPaymentsTotal: 0,
    cashExpectedTotal: 1000,
    cashCurrentTotal: 1000,
    cashTotal: 1000,
    paymentSummary: { efectivo: 0, tarjeta: 0, credito: 0 },
    openedAt: nowIso,
    closedAt: null,
    openedBy: { id: 77, username: 'operario', displayName: 'Operario Test' },
    closedBy: null
  };
}

// El backend mockeado esta en otro origin que el preview server (127.0.0.1:4173
// vs laclaudiabackend.onrender.com), asi que el browser hace un preflight
// OPTIONS y exige headers CORS en la respuesta real. Sin esto, page.route()
// devuelve el body correcto pero el browser lo descarta como net::ERR_FAILED.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

async function fulfillJson(route, status, body) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({ status, contentType: 'application/json', headers: CORS_HEADERS, body: JSON.stringify(body) });
}

async function mockBackend(page) {
  // Red de seguridad: cualquier llamada a /api no mockeada explicitamente mas
  // abajo se corta aca. VITE_API_URL de este build apunta al backend real de
  // produccion - esto asegura que ninguna venta de esta prueba llegue ahi.
  await page.route('**/api/**', async (route) => {
    await fulfillJson(route, 200, { ok: true });
  });

  await page.route('**/api/health', async (route) => {
    await fulfillJson(route, 200, { ok: true });
  });

  await page.route('**/api/auth/login', async (route) => {
    await fulfillJson(route, 200, {
      user: { id: 77, username: 'operario', display_name: 'Operario Test', role: 'operario' },
      session: { token: 'e2e-token-operario' }
    });
  });

  const openShift = buildOpenShift();
  await page.route('**/api/scanner/shifts/current*', async (route) => {
    await fulfillJson(route, 200, { shiftState: { date: openShift.businessDate, shifts: [openShift], activeShift: openShift } });
  });

  await page.route('**/api/scanner/customers', async (route) => {
    await fulfillJson(route, 200, { customers: [] });
  });

  let saleCount = 0;
  await page.route('**/api/scanner/sales', async (route) => {
    saleCount += 1;
    await fulfillJson(route, 200, { ok: true, id: `sale-${saleCount}` });
  });

  await page.route('**/api/scanner/live-state', async (route) => {
    await fulfillJson(route, 200, { ok: true });
  });

  return () => saleCount;
}

// La UI ya no tiene un boton generico "Producto manual": son 5 botones de
// categoria rapida (Fruta/Verduras, Fiambre, Fideo, Producto x kg, Otros) que
// abren el mismo modal. Usamos "Otros" como equivalente generico.
async function addManualProduct(page, price) {
  await page
    .getByRole('group', { name: 'Productos manuales rapidos' })
    .getByRole('button', { name: 'Otros', exact: true })
    .click();
  await page.getByPlaceholder('Ej: 150').fill(String(price));
  await page.getByRole('button', { name: 'Agregar' }).click();
}

test.describe('Caja 1 / Caja 2', () => {
  test('cada caja mantiene su propio carrito, sin mezclarse al cambiar', async ({ page }) => {
    await mockBackend(page);

    await page.goto('/');
    await page.getByRole('button', { name: /Entrar como Operario/i }).click();
    await expect(page.getByRole('tab', { name: 'Caja 1' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Caja 2' })).toBeVisible();

    const productsTable = page.locator('.scanner-products-table');

    // --- Caja 1: cliente con productos pendientes, venta sin terminar ---
    await addManualProduct(page, 150);
    await addManualProduct(page, 200);
    await addManualProduct(page, 80);

    await expect(productsTable).toContainText('$150.00');
    await expect(productsTable).toContainText('$200.00');
    await expect(productsTable).toContainText('$80.00');
    await expect(page.getByRole('tab', { name: 'Caja 1' })).toContainText('3');

    // --- Llega otro cliente: cambio a Caja 2, aparece limpia ---
    await page.getByRole('tab', { name: 'Caja 2' }).click();
    await expect(productsTable).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Caja 2' }).locator('.scanner-caja-tab-badge')).toHaveCount(0);

    // Atiendo al segundo cliente en Caja 2.
    await addManualProduct(page, 999);
    await expect(productsTable).toContainText('$999.00');
    await expect(productsTable).not.toContainText('$150.00');
    await expect(page.getByRole('tab', { name: 'Caja 2' })).toContainText('1');

    // --- Vuelvo a Caja 1: los 3 productos del primer cliente siguen ahi tal cual ---
    await page.getByRole('tab', { name: 'Caja 1' }).click();
    await expect(productsTable).toContainText('$150.00');
    await expect(productsTable).toContainText('$200.00');
    await expect(productsTable).toContainText('$80.00');
    await expect(productsTable).not.toContainText('$999.00');
    await expect(page.getByRole('tab', { name: 'Caja 1' })).toContainText('3');
  });

  test('cobrar Caja 2 solo limpia Caja 2; Caja 1 sigue con su venta pendiente', async ({ page }) => {
    const getSaleCount = await mockBackend(page);

    await page.goto('/');
    await page.getByRole('button', { name: /Entrar como Operario/i }).click();

    const productsTable = page.locator('.scanner-products-table');

    // Caja 1: venta pendiente de 2 productos, sin cobrar.
    await addManualProduct(page, 150);
    await addManualProduct(page, 200);
    await expect(page.getByRole('tab', { name: 'Caja 1' })).toContainText('2');

    // Caja 2: venta rapida de un cliente nuevo, la cobro.
    await page.getByRole('tab', { name: 'Caja 2' }).click();
    await addManualProduct(page, 50);
    await page.getByRole('button', { name: 'Cobrar' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirmar cobro' })).toBeVisible();
    await page.locator('#scanner-cash-received').fill('1000');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Compra confirmada')).toBeVisible();

    // Caja 2 queda limpia (sin boton Cobrar, sin productos, sin insignia).
    await expect(page.getByRole('button', { name: 'Cobrar' })).toHaveCount(0);
    await expect(productsTable).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Caja 2' }).locator('.scanner-caja-tab-badge')).toHaveCount(0);
    expect(getSaleCount()).toBe(1);

    // Caja 1 sigue exactamente como estaba, con sus 2 productos pendientes.
    await page.getByRole('tab', { name: 'Caja 1' }).click();
    await expect(productsTable).toContainText('$150.00');
    await expect(productsTable).toContainText('$200.00');
    await expect(page.getByRole('tab', { name: 'Caja 1' })).toContainText('2');
    // Cobrar Caja 2 no debe haber disparado una segunda venta contra Caja 1.
    expect(getSaleCount()).toBe(1);
  });

  test('las pestañas se bloquean mientras hay un modal de alta abierto', async ({ page }) => {
    await mockBackend(page);

    await page.goto('/');
    await page.getByRole('button', { name: /Entrar como Operario/i }).click();

    await page.getByRole('button', { name: 'Otros' }).click();
    await expect(page.getByRole('dialog', { name: 'Otros' })).toBeVisible();

    await expect(page.getByRole('tab', { name: 'Caja 2' })).toBeDisabled();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog', { name: 'Otros' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Caja 2' })).toBeEnabled();
  });
});
