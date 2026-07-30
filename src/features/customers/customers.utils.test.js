import { describe, expect, it } from 'vitest';
import { buildCustomerHistoryTicketPayload } from './customers.utils';

describe('buildCustomerHistoryTicketPayload', () => {
  it('arma el ticket a partir de los items cubiertos que devuelve el backend, con fecha de ahora', () => {
    const before = Date.now();
    const result = buildCustomerHistoryTicketPayload({
      customer: { id: 7 },
      coveredItems: [
        { name: 'Leche', quantity: 2, lineTotal: 200 },
        { name: 'Pan', quantity: 1, lineTotal: 80 }
      ],
      currentUser: { username: 'nova' }
    });
    const after = Date.now();

    expect(result.hasSales).toBe(true);
    expect(result.ticket.externalId).toBe('CTA-7');
    expect(result.ticket.total).toBe(280);
    expect(result.ticket.items).toEqual([
      { nombre: 'Leche', quantity: 2, precio_venta: 100 },
      { nombre: 'Pan', quantity: 1, precio_venta: 80 }
    ]);

    // La fecha del ticket es "ahora" (momento de impresion), no la de una venta vieja.
    const chargedAtMs = new Date(result.ticket.chargedAtIso).getTime();
    expect(chargedAtMs).toBeGreaterThanOrEqual(before);
    expect(chargedAtMs).toBeLessThanOrEqual(after);
  });

  it('marca hasSales en false sin items cubiertos', () => {
    const result = buildCustomerHistoryTicketPayload({
      customer: { id: 3 },
      coveredItems: [],
      currentUser: { username: 'nova' }
    });

    expect(result.hasSales).toBe(false);
    expect(result.ticket.items).toEqual([]);
  });
});
