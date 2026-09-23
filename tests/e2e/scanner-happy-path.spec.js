import { expect, test } from '@playwright/test';

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

function buildOpenShift(userId) {
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
    openedBy: { id: userId, username: 'operario', displayName: 'Operario Test' },
    closedBy: null
  };
}

async function mockShiftAndCustomers(page, userId) {
  const openShift = buildOpenShift(userId);
  await page.route('**/api/scanner/shifts/current*', async (route) => {
    await fulfillJson(route, 200, { shiftState: { date: openShift.businessDate, shifts: [openShift], activeShift: openShift } });
  });

  await page.route('**/api/scanner/customers', async (route) => {
    await fulfillJson(route, 200, { customers: [] });
  });
}

test.describe('Scanner critical flow', () => {
  test('operario: producto manual + cobrar + carrito vacio', async ({ page }) => {
    let saleCount = 0;

    await page.route('**/api/health', async (route) => {
      await fulfillJson(route, 200, { ok: true });
    });

    await page.route('**/api/auth/login', async (route) => {
      await fulfillJson(route, 200, {
        user: { id: 77, username: 'operario', display_name: 'Operario Test', role: 'operario' },
        session: { token: 'e2e-token-operario' }
      });
    });

    await mockShiftAndCustomers(page, 77);

    await page.route('**/api/scanner/sales', async (route) => {
      saleCount += 1;
      await fulfillJson(route, 200, { ok: true, id: `sale-${saleCount}` });
    });

    await page.route('**/api/scanner/live-state', async (route) => {
      await fulfillJson(route, 200, { ok: true });
    });

    await page.goto('/');

    await page.getByRole('button', { name: /Entrar como Operario/i }).click();
    await expect(page.getByRole('button', { name: 'Otros' })).toBeVisible();

    await page.getByRole('button', { name: 'Otros' }).click();
    await expect(page.getByRole('dialog', { name: 'Otros' })).toBeVisible();

    await page.getByPlaceholder('Ej: 150').fill('150');
    await page.getByRole('button', { name: 'Agregar' }).click();

    const productsTable = page.locator('.scanner-products-table');
    await expect(productsTable).toContainText('Otros');
    await expect(productsTable).toContainText('$150.00');

    await page.getByRole('button', { name: 'Cobrar' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirmar cobro' })).toBeVisible();
    await page.locator('#scanner-cash-received').fill('200');
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByText('Compra confirmada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cobrar' })).toHaveCount(0);
    expect(saleCount).toBe(1);
  });

  test('operario: cobro optimista con error de sync en background', async ({ page }) => {
    let saleCalls = 0;

    await page.route('**/api/health', async (route) => {
      await fulfillJson(route, 200, { ok: true });
    });

    await page.route('**/api/auth/login', async (route) => {
      await fulfillJson(route, 200, {
        user: { id: 88, username: 'operario', display_name: 'Operario Test', role: 'operario' },
        session: { token: 'e2e-token-operario' }
      });
    });

    await mockShiftAndCustomers(page, 88);

    await page.route('**/api/scanner/sales', async (route) => {
      saleCalls += 1;
      await fulfillJson(route, 500, { message: 'sync fail' });
    });

    await page.route('**/api/scanner/live-state', async (route) => {
      await fulfillJson(route, 200, { ok: true });
    });

    await page.goto('/');

    await page.getByRole('button', { name: /Entrar como Operario/i }).click();
    await expect(page.getByRole('button', { name: 'Otros' })).toBeVisible();

    await page.getByRole('button', { name: 'Otros' }).click();
    await page.getByPlaceholder('Ej: 150').fill('99');
    await page.getByRole('button', { name: 'Agregar' }).click();

    await page.getByRole('button', { name: 'Cobrar' }).click();
    await page.locator('#scanner-cash-received').fill('100');
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Optimistic checkout: success toast appears immediately.
    await expect(page.getByText('Compra confirmada')).toBeVisible();
    // Cart is cleared immediately even if backend sync fails later.
    await expect(page.getByRole('button', { name: 'Cobrar' })).toHaveCount(0);
    // Background sync failure warning should appear (fires after the 2nd failed retry).
    await expect(page.getByText(/No se pudo sincronizar una compra/i)).toBeVisible({ timeout: 15000 });
    const pendingQueueRaw = await page.evaluate(() => window.localStorage.getItem('scanner_sales_queue_v1'));
    const pendingQueue = pendingQueueRaw ? JSON.parse(pendingQueueRaw) : [];
    expect(Array.isArray(pendingQueue)).toBe(true);
    expect(pendingQueue.length).toBe(1);
    expect(saleCalls).toBeGreaterThan(0);
  });
});
