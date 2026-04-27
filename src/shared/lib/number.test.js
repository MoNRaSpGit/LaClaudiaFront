import { describe, expect, it } from 'vitest';
import { parsePositiveAmount } from './number';

describe('parsePositiveAmount', () => {
  it('acepta decimales con coma o punto y redondea a 2 decimales', () => {
    expect(parsePositiveAmount('10,235')).toBe(10.23);
    expect(parsePositiveAmount('10.236')).toBe(10.24);
  });

  it('rechaza vacio, cero, negativos y texto invalido', () => {
    expect(parsePositiveAmount('')).toBeNull();
    expect(parsePositiveAmount('0')).toBeNull();
    expect(parsePositiveAmount('-1')).toBeNull();
    expect(parsePositiveAmount('abc')).toBeNull();
  });
});

