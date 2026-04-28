import { expect, test } from '@playwright/test';

test.describe('Scanner critical flow', () => {
  test('operario: producto manual + cobrar + carrito vacio', async ({ page }) => {
    let saleCount = 0;

    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 77,
            username: 'operario',
            display_name: 'Operario Test',
            role: 'operario'
          },
          session: {
            token: 'e2e-token-operario'
          }
        })
      });
    });

    await page.route('**/api/scanner/sales', async (route) => {
      saleCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: `sale-${saleCount}` })
      });
    });

    await page.route('**/api/scanner/live-state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto('/');

    await page.getByRole('button', { name: /Entrar como Operario/i }).click();
    await expect(page.getByRole('button', { name: 'Producto manual' })).toBeVisible();

    await page.getByRole('button', { name: 'Producto manual' }).click();
    await expect(page.getByRole('dialog', { name: 'Producto manual' })).toBeVisible();

    await page.getByPlaceholder('Ej: 150').fill('150');
    await page.getByRole('button', { name: 'Agregar' }).click();

    const productsTable = page.locator('.scanner-products-table');
    await expect(productsTable).toContainText('Producto Manual');
    await expect(productsTable).toContainText('$150.00');

    await page.getByRole('button', { name: 'Cobrar' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirmar cobro' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByText('Compra confirmada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cobrar' })).toHaveCount(0);
    expect(saleCount).toBe(1);
  });

  test('operario: cobro optimista con error de sync en background', async ({ page }) => {
    let saleCalls = 0;

    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 88,
            username: 'operario',
            display_name: 'Operario Test',
            role: 'operario'
          },
          session: {
            token: 'e2e-token-operario'
          }
        })
      });
    });

    await page.route('**/api/scanner/sales', async (route) => {
      saleCalls += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'sync fail' })
      });
    });

    await page.route('**/api/scanner/live-state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto('/');

    await page.getByRole('button', { name: /Entrar como Operario/i }).click();
    await expect(page.getByRole('button', { name: 'Producto manual' })).toBeVisible();

    await page.getByRole('button', { name: 'Producto manual' }).click();
    await page.getByPlaceholder('Ej: 150').fill('99');
    await page.getByRole('button', { name: 'Agregar' }).click();

    await page.getByRole('button', { name: 'Cobrar' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Optimistic checkout: success toast appears immediately.
    await expect(page.getByText('Compra confirmada')).toBeVisible();
    // Cart is cleared immediately even if backend sync fails later.
    await expect(page.getByRole('button', { name: 'Cobrar' })).toHaveCount(0);
    // Background sync failure warning should appear.
    await expect(page.getByText(/Hubo un error en la ultima compra/i)).toBeVisible();
    const pendingQueueRaw = await page.evaluate(() => window.localStorage.getItem('scanner_sales_queue_v1'));
    const pendingQueue = pendingQueueRaw ? JSON.parse(pendingQueueRaw) : [];
    expect(Array.isArray(pendingQueue)).toBe(true);
    expect(pendingQueue.length).toBe(1);
    expect(saleCalls).toBeGreaterThan(0);
  });
});
